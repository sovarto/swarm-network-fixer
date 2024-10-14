import { execSync } from 'child_process';
import Docker, { NetworkContainer, NetworkInspectInfo } from 'dockerode';
import express from 'express';
import * as util from 'node:util';
import { exit } from 'process';
import { EndpointRecord } from './protobuf/endpoint_table';
import { PeerRecord } from './protobuf/overlay_peer_table';

const checkIntervalInSeconds = parseInt(
    process.env.CHECK_INTERVAL_IN_SECONDS || '60'
);
const networkDiagnosticServerPort = parseInt(
    process.env.NETWORK_DIAGNOSTIC_PORT || '2000'
);

const port = parseInt(process.env.PORT || '3175');

const docker = new Docker();

function getFetchTableUrl(tableName: string, networkId: string) {
    return `http://localhost:${networkDiagnosticServerPort}/gettable?nid=${networkId}&tname=${tableName}&json`;
}

function getDeleteEntryUrl(tableName: string, networkId: string, key: string) {
    return `http://localhost:${networkDiagnosticServerPort}/deleteentry?tname=${tableName}&nid=${networkId}&key=${key}`;
}

interface GetTableResult {
    message: string;
    details: {
        size: number;
        entries: { key: string; value: string; owner: string }[];
    };
}

function hasContainerWithIp(network: { Containers?: Record<string, NetworkContainer> },
    ip: string) {
    const containers = Object.entries(network.Containers || {})
        .map(([id, container]) => ({ ...container, id }));
    return containers.some((x) => x.IPv4Address.split('/')[0] === ip);
}

async function checkTable(tableName: string, network: NetworkInspectInfo) {
    let decoder: (input: Uint8Array) => { endpointIp: string };
    switch (tableName) {
        case 'endpoint_table':
            decoder = EndpointRecord.decode;
            break;
        case 'overlay_peer_table':
            decoder = PeerRecord.decode;
            break;
        default:
            throw new Error(`Unknown table name '${tableName}'`);
    }

    const result = await fetch(getFetchTableUrl(tableName, network.Id));
    const json = (await result.json()) as GetTableResult;
    if (!json.details.entries?.length) {
        return [];
    }

    const entries = json.details.entries.map((x) => ({
        ...x,
        value: decoder(Buffer.from(x.value, 'base64')),
    }));

    // console.log(entries);

    const grouped = entries.reduce<Record<string, Map<string, string[]>>>(
        (acc, curr) => {
            if (!acc[curr.value.endpointIp]) {
                acc[curr.value.endpointIp] = new Map();
            }
            const keys = acc[curr.value.endpointIp].get(curr.owner) || [];
            keys.push(curr.key);
            acc[curr.value.endpointIp].set(curr.owner, keys);
            return acc;
        }, {});

    const invalidEntries = Object.entries(grouped)
        .filter(([_, entries]) => entries.size > 1)
        .map(([endpointIp, entries]) => ({
            endpointIp: endpointIp.split('/')[0],
            entries: [...entries].map(([owner, keys]) => ({ owner, keys }))
        }));

    if (invalidEntries.length) {
        console.log(
            `Found invalid entries in table '${tableName}'.\n\n`,
            util.inspect(invalidEntries, { depth: null })
        );

        return invalidEntries;
    } else {
        console.log(`Found no invalid entries in table '${tableName}'.`);
    }

    return [];
}

async function getOwnPeerName(networkId: string) {
    const info = await docker.info();
    const ownAddress = info.Swarm.NodeAddr;
    const networkDetails = await docker.getNetwork(networkId).inspect();
    if (!networkDetails.Peers?.length) {
        return { ownPeerName: null, peerIps: [] };
    }
    const peers: { Name: string; IP: string }[] = networkDetails.Peers;
    const ownPeerName = peers.filter(x => x.IP === ownAddress)[0].Name;
    const peerIps = peers.reduce<Record<string, string>>((acc, curr) => {
        acc[curr.Name] = curr.IP;
        return acc;
    }, {});
    console.log('Own peer name: ', ownPeerName);
    return { ownPeerName, peerIps };
}

async function checkTables() {
    try {
        console.log('Checking tables...');
        for (const network of await docker.listNetworks()) {
            if (network.Scope !== 'swarm' || network.Driver !== 'overlay') {
                continue;
            }

            console.log(`...for network ${network.Name} (${network.Id})`);
            const { ownPeerName, peerIps } = await getOwnPeerName(network.Id);
            if (!ownPeerName?.length) {
                console.warn(
                    `Couldn't determine own peer name for network ${network.Name}. Probably, because there are no containers participating in that network on this node. Skipping handling network.`
                );
                continue;
            }

            const tablesToCheck = ['endpoint_table', 'overlay_peer_table'];
            for (const table of tablesToCheck) {
                for (const invalidEntry of await checkTable(table, network)) {
                    for (const { owner, keys } of invalidEntry.entries) {
                        if (owner === ownPeerName) {
                            try {
                                if (!hasContainerWithIp(network, invalidEntry.endpointIp)) {
                                    for (const key of keys) {
                                        console.log(`Deleting invalid entry for IP ${ invalidEntry.endpointIp } with key ${ key } owned by us...`);
                                        await deleteEntry(table, network.Id, key);
                                    }
                                }
                            } catch (e) {
                                console.warn(`Error while checking entry for IP ${invalidEntry.endpointIp} with keys ${keys} owned by us:\n`,
                                    e);
                            }
                        } else {
                            try {
                                if (!(await hasOwnerContainerWithIp(peerIps[owner],
                                    network.Id,
                                    invalidEntry.endpointIp))) {
                                    for (const key of keys) {
                                        console.log(`Deleting invalid entry for IP ${ invalidEntry.endpointIp } with key ${ key } owned by ${ owner } (IP: ${ peerIps[owner] })...`);
                                        await deleteEntry(table, network.Id, key);
                                    }
                                }
                            } catch (e) {
                                console.warn(`Error while checking entry for IP ${invalidEntry.endpointIp} with keys ${keys} owned by ${owner} (IP: ${peerIps[owner]}):\n`,
                                    e);
                            }
                        }
                    }
                }
            }
        }
        console.log(`Done. Checking again in ${checkIntervalInSeconds} seconds.`);
    } catch (e) {
        console.warn(`Error checking tables. Retrying in ${checkIntervalInSeconds} seconds.\n`, e);
    }
    setTimeout(checkTables, checkIntervalInSeconds * 1000);
}

async function hasOwnerContainerWithIp(ownerIp: string, networkId: string, endpointIp: string) {
    const res = await fetch(`http://${ownerIp}:${port}/networks/${networkId}/has-container-with-ip/${endpointIp}`);
    return res.status === 204;
}

async function deleteEntry(table: string, networkId: string, key: string) {
    await fetch(getDeleteEntryUrl(table, networkId, key));
}

async function main() {
    try {
        console.log('Starting container to activate network diagnostics server...');
        execSync(
            'docker run --rm --pid=host --net=host --privileged -v /etc/docker/daemon.json:/etc/docker/daemon.json -v /var/run/docker.sock:/var/run/docker.sock sovarto/enable-docker-network-diagnostic-server:1.0.0',
            { stdio: 'inherit' });
        await checkTables();
    } catch (e) {
        console.error(e);
        exit(1);
    }
}

main();

const app = express();
app.use(express.json());

app.get('/networks/:networkId/has-container-with-ip/:containerIp', async (req, res) => {
    const networkId = req.params.networkId;
    const containerIp = req.params.containerIp;

    const network = await docker.getNetwork(networkId).inspect();
    if (hasContainerWithIp(network, containerIp)) {
        res.status(204).send();
    } else {
        res.status(404).send();
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
