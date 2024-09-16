import { exit } from "process";
import { PeerRecord } from "./protobuf/overlay_peer_table";
import Docker, { ContainerInfo, ContainerInspectInfo, NetworkContainer, NetworkInspectInfo } from "dockerode";
import { EndpointRecord } from "./protobuf/endpoint_table";
import { execSync } from "child_process";
import express from 'express';

const checkIntervalInSeconds = parseInt(
    process.env.CHECK_INTERVAL_IN_SECONDS || "60"
);
const networkDiagnosticServerPort = parseInt(
    process.env.NETWORK_DIAGNOSTIC_PORT || "2000"
);

const port = parseInt(process.env.PORT || '3175');

const docker = new Docker();

function getFetchTableUrl(tableName: string, networkId: string) {
    return `http://localhost:${networkDiagnosticServerPort}/gettable?nid=${networkId}&tname=${tableName}&json`;
}

function getLeaveNetworkUrl(networkId: string) {
    return `http://localhost:${networkDiagnosticServerPort}/leavenetwork?nid=${networkId}`;
}

function getJoinNetworkUrl(networkId: string) {
    return `http://localhost:${networkDiagnosticServerPort}/joinnetwork?nid=${networkId}`;
}

interface GetTableResult {
    message: string;
    details: {
        size: number;
        entries: { key: string; value: string; owner: string }[];
    };
}

function hasContainerWithIp(network: { Containers?: Record<string, NetworkContainer> }, ip: string) {
    const containers = Object.entries(network.Containers || {}).map(([id, container]) => ({ ...container, id }));
    return containers.some((x) => x.IPv4Address.split('/')[0] === ip)
}

async function checkTable(tableName: string, network: NetworkInspectInfo, ownPeerName: string) {
    let decoder: (input: Uint8Array) => { endpointIp: string };
    switch (tableName) {
        case "endpoint_table":
            decoder = EndpointRecord.decode;
            break;
        case "overlay_peer_table":
            decoder = PeerRecord.decode;
            break;
        default:
            throw new Error(`Unknown table name '${tableName}'`);
    }

    const result = await fetch(getFetchTableUrl(tableName, network.Id));
    const json = (await result.json()) as GetTableResult;
    if (!json.details.entries?.length) return;

    const entries = json.details.entries.map((x) => ({
        ...x,
        value: decoder(Buffer.from(x.value, "base64")),
    }));

    // console.log(entries);

    // We are using a Set here, because multiple entries with the same owner are considered the same for now
    // TODO: Add special handling for the case where multiple entries have the same owner but different values
    const grouped = entries.reduce<Record<string, Set<string>>>((acc, curr) => {
        if (!acc[curr.value.endpointIp]) {
            acc[curr.value.endpointIp] = new Set();
        }
        acc[curr.value.endpointIp].add(curr.owner);
        return acc;
    }, {});

    //console.log(grouped);

    const invalidEntries = Object.entries(grouped)
        .filter(([endpointIp, owners]) => owners.size > 1)
        .map(([endpointIp, owners]) => ({ endpointIp: endpointIp.split('/')[0], owners: [...owners] }));

    if (invalidEntries.length) {
        console.log(
            `Found invalid entries in table '${tableName}'. This message shouldn't repeat itself for a longer period, if each node in the Swarm cluster runs this tool\n\n`,
            invalidEntries
        );

        let rejoinSelf = false;

        const invalidEntriesOwnedByUs = invalidEntries.filter((x) => x.owners.some((y) => y === ownPeerName));
        for (const invalidEntry of invalidEntriesOwnedByUs) {
            if (!hasContainerWithIp(network, invalidEntry.endpointIp)) {
                console.log(
                    `This node owns an entry in the '${tableName}' table for a container that it is not running. Fixing it by leaving and re-joining the network.`
                );
                rejoinSelf = true;
                break;
            }
        }

        return {
            nodesToPotentiallyRejoin: invalidEntries.reduce<Record<string, string[]>>((acc, curr) => {
                for (const owner of curr.owners) {
                    if (owner !== ownPeerName) {
                        if (!acc[owner]?.length) {
                            acc[owner] = [];
                        }
                        acc[owner].push(curr.endpointIp)
                    }
                }
                return acc;
            }, {}),
            rejoinSelf
        };
    } else {
        console.log(`Found no invalid entries in table '${tableName}'.`);
    }

    return;
}

async function getOwnPeerName(networkId: string) {
    const info = await docker.info();
    const ownAddress = info.Swarm.NodeAddr;
    const networkDetails = await docker.getNetwork(networkId).inspect();
    if (!networkDetails.Peers?.length)
        return { ownPeerName: null, peerIps: [] };
    const peers: { Name: string; IP: string }[] = networkDetails.Peers;
    const ownPeerName = peers.filter(x => x.IP === ownAddress)[0].Name;
    const peerIps = peers.reduce<Record<string, string>>((acc, curr) => {
        acc[curr.Name] = curr.IP;
        return acc
    }, {});
    console.log('Own peer name: ', ownPeerName);
    return { ownPeerName, peerIps };
}

async function rejoinNetwork(network: { Id: string, Name: string }) {
    await fetch(getLeaveNetworkUrl(network.Id));
    await fetch(getJoinNetworkUrl(network.Id));
    console.log(`Rejoined network ${network.Name}`)
}

async function checkTables() {
    console.log("Checking tables...");
    for (const network of await docker.listNetworks()) {
        if (network.Scope !== "swarm" || network.Driver !== "overlay")
            continue;

        console.log(`...for network ${network.Name} (${network.Id})`);
        const { ownPeerName, peerIps } = await getOwnPeerName(network.Id);
        if (!ownPeerName?.length) {
            console.warn(
                `Couldn't determine own peer name for network ${network.Name}. Probably, because there are no containers participating in that network on this node. Skipping handling network.`
            );
            continue;
        }
        const invalidEntryInEndpointTable = await checkTable('endpoint_table', network, ownPeerName);
        const invalidEntryInOverlayPeerTable = await checkTable('overlay_peer_table', network, ownPeerName);

        if (invalidEntryInEndpointTable?.rejoinSelf || invalidEntryInOverlayPeerTable?.rejoinSelf) {
            await rejoinNetwork(network);
        }

        const nodesToPotentiallyRejoin = [
            ...Object.entries(invalidEntryInEndpointTable?.nodesToPotentiallyRejoin || {}),
            ...Object.entries(invalidEntryInOverlayPeerTable?.nodesToPotentiallyRejoin || {})]
            .reduce<Record<string, Set<string>>>((acc, [owner, endpointIps]) => {
                if (!acc[owner]?.size) {
                    acc[owner] = new Set<string>();
                }
                for (const endpointIp of endpointIps)
                    acc[owner].add(endpointIp)
                return acc;
            }, {});

        for (const [nodePeerName, endpointIps] of Object.entries(nodesToPotentiallyRejoin)) {
            try {
                console.log(`Asking peer ${nodePeerName} to rejoin network ${network.Name} if necessary`)
                await fetch(`http://${peerIps[nodePeerName]}:${port}/rejoin-if-necessary/${network.Id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpointIps: [...endpointIps]
                    })
                });
            } catch (e) {
                console.warn(`Error asking peer ${nodePeerName} to rejoin network ${network.Name} if necessary: `, e);
            }
        }
    }
    console.log("Done");
    setTimeout(checkTables, checkIntervalInSeconds * 1000);
}

async function main() {
    try {
        execSync('docker run --rm --pid=host --net=host --privileged -v /etc/docker/daemon.json:/etc/docker/daemon.json -v /var/run/docker.sock:/var/run/docker.sock sovarto/enable-docker-network-diagnostic-server:1.0.0', { stdio: "inherit" })
        await checkTables();
    } catch (e) {
        console.error(e);
        exit(1);
    }
}

main();

const app = express();
app.use(express.json());

app.post('/rejoin-if-necessary/:networkId', async (req, res) => {
    const networkId = req.params.networkId;        // Extract networkId from URL
    const endpointIps = req.body.endpointIps;      // Extract endpoint IPs array from body

    // Validate the received data
    if (!Array.isArray(endpointIps)) {
        return res.status(400).send('endpointIps must be an array.');
    }

    console.log(`Received request to rejoin network ${networkId}, if at least one of the following IPs has no corresponding container on this node:\n`, endpointIps);

    const network = await docker.getNetwork(networkId).inspect();
    if (endpointIps.some(x => !hasContainerWithIp(network, x))) {
        console.log('At least for some of the specified IPs there is no container running on this node, so we rejoin')
        await rejoinNetwork(network);
    } else {
        console.log('For all specified IPs, there is a corresponding container running on this node. Not rejoining.')
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


