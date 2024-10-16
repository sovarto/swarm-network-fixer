// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.2.0
//   protoc               v3.21.12
// source: protobuf/endpoint_table.proto

/* eslint-disable */
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";

export const protobufPackage = "";

/**
 * EndpointRecord specifies all the endpoint specific information that
 * needs to gossiped to nodes participating in the network.
 */
export interface EndpointRecord {
  /** Name of the container */
  name: string;
  /** Service name of the service to which this endpoint belongs. */
  serviceName: string;
  /** Service ID of the service to which this endpoint belongs. */
  serviceId: string;
  /** Virtual IP of the service to which this endpoint belongs. */
  virtualIp: string;
  /** IP assigned to this endpoint. */
  endpointIp: string;
  /** IngressPorts exposed by the service to which this endpoint belongs. */
  ingressPorts: PortConfig[];
  /** A list of aliases which are alternate names for the service */
  aliases: string[];
  /** List of aliases task specific aliases */
  taskAliases: string[];
  /** Whether this enpoint's service has been disabled */
  serviceDisabled: boolean;
}

/**
 * PortConfig specifies an exposed port which can be
 * addressed using the given name. This can be later queried
 * using a service discovery api or a DNS SRV query. The node
 * port specifies a port that can be used to address this
 * service external to the cluster by sending a connection
 * request to this port to any node on the cluster.
 */
export interface PortConfig {
  /**
   * Name for the port. If provided the port information can
   * be queried using the name as in a DNS SRV query.
   */
  name: string;
  /** Protocol for the port which is exposed. */
  protocol: PortConfig_Protocol;
  /** The port which the application is exposing and is bound to. */
  targetPort: number;
  /**
   * PublishedPort specifies the port on which the service is
   * exposed on all nodes on the cluster. If not specified an
   * arbitrary port in the node port range is allocated by the
   * system. If specified it should be within the node port
   * range and it should be available.
   */
  publishedPort: number;
}

export enum PortConfig_Protocol {
  TCP = 0,
  UDP = 1,
  SCTP = 2,
  UNRECOGNIZED = -1,
}

export function portConfig_ProtocolFromJSON(object: any): PortConfig_Protocol {
  switch (object) {
    case 0:
    case "TCP":
      return PortConfig_Protocol.TCP;
    case 1:
    case "UDP":
      return PortConfig_Protocol.UDP;
    case 2:
    case "SCTP":
      return PortConfig_Protocol.SCTP;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PortConfig_Protocol.UNRECOGNIZED;
  }
}

export function portConfig_ProtocolToJSON(object: PortConfig_Protocol): string {
  switch (object) {
    case PortConfig_Protocol.TCP:
      return "TCP";
    case PortConfig_Protocol.UDP:
      return "UDP";
    case PortConfig_Protocol.SCTP:
      return "SCTP";
    case PortConfig_Protocol.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

function createBaseEndpointRecord(): EndpointRecord {
  return {
    name: "",
    serviceName: "",
    serviceId: "",
    virtualIp: "",
    endpointIp: "",
    ingressPorts: [],
    aliases: [],
    taskAliases: [],
    serviceDisabled: false,
  };
}

export const EndpointRecord: MessageFns<EndpointRecord> = {
  encode(message: EndpointRecord, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.serviceName !== "") {
      writer.uint32(18).string(message.serviceName);
    }
    if (message.serviceId !== "") {
      writer.uint32(26).string(message.serviceId);
    }
    if (message.virtualIp !== "") {
      writer.uint32(34).string(message.virtualIp);
    }
    if (message.endpointIp !== "") {
      writer.uint32(42).string(message.endpointIp);
    }
    for (const v of message.ingressPorts) {
      PortConfig.encode(v!, writer.uint32(50).fork()).join();
    }
    for (const v of message.aliases) {
      writer.uint32(58).string(v!);
    }
    for (const v of message.taskAliases) {
      writer.uint32(66).string(v!);
    }
    if (message.serviceDisabled !== false) {
      writer.uint32(72).bool(message.serviceDisabled);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): EndpointRecord {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEndpointRecord();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.serviceName = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.serviceId = reader.string();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.virtualIp = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.endpointIp = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.ingressPorts.push(PortConfig.decode(reader, reader.uint32()));
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.aliases.push(reader.string());
          continue;
        case 8:
          if (tag !== 66) {
            break;
          }

          message.taskAliases.push(reader.string());
          continue;
        case 9:
          if (tag !== 72) {
            break;
          }

          message.serviceDisabled = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): EndpointRecord {
    return {
      name: isSet(object.name) ? globalThis.String(object.name) : "",
      serviceName: isSet(object.serviceName) ? globalThis.String(object.serviceName) : "",
      serviceId: isSet(object.serviceId) ? globalThis.String(object.serviceId) : "",
      virtualIp: isSet(object.virtualIp) ? globalThis.String(object.virtualIp) : "",
      endpointIp: isSet(object.endpointIp) ? globalThis.String(object.endpointIp) : "",
      ingressPorts: globalThis.Array.isArray(object?.ingressPorts)
        ? object.ingressPorts.map((e: any) => PortConfig.fromJSON(e))
        : [],
      aliases: globalThis.Array.isArray(object?.aliases) ? object.aliases.map((e: any) => globalThis.String(e)) : [],
      taskAliases: globalThis.Array.isArray(object?.taskAliases)
        ? object.taskAliases.map((e: any) => globalThis.String(e))
        : [],
      serviceDisabled: isSet(object.serviceDisabled) ? globalThis.Boolean(object.serviceDisabled) : false,
    };
  },

  toJSON(message: EndpointRecord): unknown {
    const obj: any = {};
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.serviceName !== "") {
      obj.serviceName = message.serviceName;
    }
    if (message.serviceId !== "") {
      obj.serviceId = message.serviceId;
    }
    if (message.virtualIp !== "") {
      obj.virtualIp = message.virtualIp;
    }
    if (message.endpointIp !== "") {
      obj.endpointIp = message.endpointIp;
    }
    if (message.ingressPorts?.length) {
      obj.ingressPorts = message.ingressPorts.map((e) => PortConfig.toJSON(e));
    }
    if (message.aliases?.length) {
      obj.aliases = message.aliases;
    }
    if (message.taskAliases?.length) {
      obj.taskAliases = message.taskAliases;
    }
    if (message.serviceDisabled !== false) {
      obj.serviceDisabled = message.serviceDisabled;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<EndpointRecord>, I>>(base?: I): EndpointRecord {
    return EndpointRecord.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<EndpointRecord>, I>>(object: I): EndpointRecord {
    const message = createBaseEndpointRecord();
    message.name = object.name ?? "";
    message.serviceName = object.serviceName ?? "";
    message.serviceId = object.serviceId ?? "";
    message.virtualIp = object.virtualIp ?? "";
    message.endpointIp = object.endpointIp ?? "";
    message.ingressPorts = object.ingressPorts?.map((e) => PortConfig.fromPartial(e)) || [];
    message.aliases = object.aliases?.map((e) => e) || [];
    message.taskAliases = object.taskAliases?.map((e) => e) || [];
    message.serviceDisabled = object.serviceDisabled ?? false;
    return message;
  },
};

function createBasePortConfig(): PortConfig {
  return { name: "", protocol: 0, targetPort: 0, publishedPort: 0 };
}

export const PortConfig: MessageFns<PortConfig> = {
  encode(message: PortConfig, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.protocol !== 0) {
      writer.uint32(16).int32(message.protocol);
    }
    if (message.targetPort !== 0) {
      writer.uint32(24).uint32(message.targetPort);
    }
    if (message.publishedPort !== 0) {
      writer.uint32(32).uint32(message.publishedPort);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): PortConfig {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePortConfig();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.protocol = reader.int32() as any;
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.targetPort = reader.uint32();
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.publishedPort = reader.uint32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): PortConfig {
    return {
      name: isSet(object.name) ? globalThis.String(object.name) : "",
      protocol: isSet(object.protocol) ? portConfig_ProtocolFromJSON(object.protocol) : 0,
      targetPort: isSet(object.targetPort) ? globalThis.Number(object.targetPort) : 0,
      publishedPort: isSet(object.publishedPort) ? globalThis.Number(object.publishedPort) : 0,
    };
  },

  toJSON(message: PortConfig): unknown {
    const obj: any = {};
    if (message.name !== "") {
      obj.name = message.name;
    }
    if (message.protocol !== 0) {
      obj.protocol = portConfig_ProtocolToJSON(message.protocol);
    }
    if (message.targetPort !== 0) {
      obj.targetPort = Math.round(message.targetPort);
    }
    if (message.publishedPort !== 0) {
      obj.publishedPort = Math.round(message.publishedPort);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<PortConfig>, I>>(base?: I): PortConfig {
    return PortConfig.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<PortConfig>, I>>(object: I): PortConfig {
    const message = createBasePortConfig();
    message.name = object.name ?? "";
    message.protocol = object.protocol ?? 0;
    message.targetPort = object.targetPort ?? 0;
    message.publishedPort = object.publishedPort ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export interface MessageFns<T> {
  encode(message: T, writer?: BinaryWriter): BinaryWriter;
  decode(input: BinaryReader | Uint8Array, length?: number): T;
  fromJSON(object: any): T;
  toJSON(message: T): unknown;
  create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
  fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}
