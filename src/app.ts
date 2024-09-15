import { exit } from "process";
import { PeerRecord } from "./protobuf/overlay_peer_table";
import Docker, { NetworkInspectInfo } from "dockerode";
import { EndpointRecord } from "./protobuf/endpoint_table";
import { exec, execSync } from "child_process";

const checkIntervalInSeconds = parseInt(
    process.env.CHECK_INTERVAL_IN_SECONDS || "60"
);
const networkDiagnosticServerPort = parseInt(
    process.env.NETWORK_DIAGNOSTIC_PORT || "2000"
);

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

    //console.log(entries);

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
        .map(([endpointIp, owners]) => ({ endpointIp, owners: [...owners] }));

    if (invalidEntries.length) {
        console.log(
            `Found invalid entries in table '${tableName}'. This message shouldn't repeat itself for a longer period, if each node in the Swarm cluster runs this tool\n\n`,
            invalidEntries
        );

        // If an invalid entry contains our own peer name and if the container is not running on our server: leavenetwork / joinnetwork
        // Assumption: The network DB is the same on each server
        const containers = Object.entries(network.Containers || {}).map(([id, container]) => ({ ...container, id }));
        if (containers.length) {
            const invalidEntriesOwnedByUs = invalidEntries.filter((x) => x.owners.some((y) => y === ownPeerName));
            for (const invalidEntry of invalidEntriesOwnedByUs) {
                if (containers.every((x) => x.IPv4Address.split('/')[0] !== invalidEntry.endpointIp.split('/')[0])) {
                    // We own an entry in the network table for a container that is not running here. That's invalid data
                    console.log(
                        `This node owns an entry in the '${tableName}' table for a container that it is not running. Fixing it by leaving and re-joining the network.`
                    );
                    return true;
                }
            }
        }
    } else {
        console.log(`Found no invalid entries in table '${tableName}'.`);
    }

    return false;
}

async function getOwnPeerName(networkId: string) {
    const info = await docker.info();
    const ownAddress = info.Swarm.NodeAddr;
    const networkDetails = await docker.getNetwork(networkId).inspect();
    if (!networkDetails.Peers?.length)
        return null;
    const ownPeerName = networkDetails.Peers.filter((x: { Name: string; IP: string }) => x.IP === ownAddress)[0].Name;
    console.log('Own peer name: ', ownPeerName);
    return ownPeerName;
}

async function checkTables() {
    console.log("Checking tables...");
    for (const network of await docker.listNetworks()) {
        if (network.Scope !== "swarm" || network.Driver !== "overlay")
            continue;

        console.log(`...for network ${network.Name} (${network.Id})`);
        const ownPeerName = await getOwnPeerName(network.Id);
        if (!ownPeerName?.length) {
            console.warn(
                `Couldn't determine own peer name for network ${network.Name}. Probably, because there are no containers participating in that network on this node. Skipping handling network.`
            );
            continue;
        }
        const invalidEntryInEndpointTable = await checkTable('endpoint_table', network, ownPeerName);
        const invalidEntryInOverlayPeerTable = await checkTable('overlay_peer_table', network, ownPeerName);

        if (invalidEntryInEndpointTable || invalidEntryInOverlayPeerTable) {
            await fetch(getLeaveNetworkUrl(network.Id));
            await fetch(getJoinNetworkUrl(network.Id));
            console.log(`Rejoined network ${network.Name}`)
        }
    }
    console.log("Done");
}

async function main() {
    try {
        execSync('docker run --rm --pid=host --net=host --privileged -v /etc/docker/daemon.json:/etc/docker/daemon.json -v /var/run/docker.sock:/var/run/docker.sock sovarto/enable-docker-network-diagnostic-server:0.0.4', { stdio: "inherit" })
        await checkTables();
        setTimeout(checkTables, checkIntervalInSeconds * 1000);
    } catch (e) {
        console.error(e);
        exit(1);
    }
}

main();
