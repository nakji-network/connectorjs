# Aave Connector

This README explains in depth how to build a connector for a protocol using Nakji libraries.

# How to Build a Connector

## Prerequisites

1. npm v9.1.1
2. node v18.2.1
3. ts-node v10.9.1
4. Docker
5. protoc

## Overview

A connector is program that runs continuously and listens to specific smart contracts on a given blockchain. In this example, we will go through how to build a connector for Aave lending protocol. We will listen to the smart contracts of Aave on Ethereum blockchain, parse incoming event logs and push them to Nakji message queue

 **It is highly recommended to use this example connector as the template to build your own connector.**

### Building the Connector

#### 1. Get protocol ABI files

An ABI (Application Binary Interface) file contains all the information on a given smart contract. It can be found  on Etherscan by searching the smart contract address. This address can be found on project's website. 

Etherscan can also be used for verification after the conenctor is finished and ingesting event logs. These logs should match the ones on Etherscan UI. 

#### 2. Create connector directory

The directory tree for your connector should be organized as following:

```
<connector_name>/
    cmd/<connector_name>/
        main.ts
    <CONTRACT_NAME>/
        <CONTRACT_NAME>.abi.json
        <CONTRACT_NAME>.proto
        <CONTRACT_NAME>_pb.js
        <CONTRACT_NAME>.ts
    local.yaml
    manifest.yaml
    types.ts
    <connector_name>.ts
    Additional files 
```

#### 3. Create contract parsers

First, enter the <CONTRACT_NAME>/ directory. Create the <CONTRACT_NAME>.abi file in <CONTRACT_NAME>/ and paste the ABI source code you copied earlier.

Next, generate the <CONTRACT_NAME>.proto file using `protogen`(you should have `protogen` installed from the above step)
.

```shell
protogen -p <CONTRACT_NAME> -i "./<CONTRACT_NAME>.abi" <contract_name>.proto
```

This creates a `.proto` file, which defines the data format for a protobuf message. A `.proto` file can define multiple messages; in our case each message corresponds to a type of event that the smart contract can emit. It should look something like this.

```protobuf
syntax = "proto3";
package LENDINGPOOL;

import "google/protobuf/timestamp.proto";

option go_package = "github.com/nakji-network/connectorjs/examples/aave/LENDINGPOOL";

message Borrow {
	google.protobuf.Timestamp ts = 1;
	bytes reserve = 2; 
	bytes user = 3; 
	bytes onBehalfOf = 4; 
	bytes amount = 5; // uint256
	bytes borrowRateMode = 6; // uint256
	bytes borrowRate = 7; // uint256
	uint32 referral = 8; 

    // These properties are added manually to mark an event log with unique identifiers
	uint64 blockNumber = 9;
	uint64 logIndex = 10;
	bytes txHash = 11;

}

message Deposit {
	google.protobuf.Timestamp ts = 1;
	bytes reserve = 2; 
	bytes user = 3; 
	bytes onBehalfOf = 4; 
	bytes amount = 5; // uint256
	uint32 referral = 6; 

    // These properties are added manually to mark an event log with unique identifiers
	uint64 blockNumber = 7;
	uint64 logIndex = 8;
	bytes txHash = 9;
}
```

You can then rename <CONTRACT_NAME>.abi to <CONTRACT_NAME>.abi.json to be able to import it in your code.

Next, generate the `<CONTRACT_NAME>_pb.js` file using `protoc`.

```shell
protoc --js_out=import_style=commonjs:.  ./<CONTRACT_NAME>.proto
```

Lastly, you should create a <CONTRACT_NAME>.ts file which will parse incoming event log to protobuf message. Easiest way to create this file is to copy [LENDINGPOOL.ts](LENDINGPOOL/LENDINGPOOL.ts) and modify according to your needs.

#### 4. Create the connector runtime files

Now you will create the files to allow your connector to call the Nakji connector library and use it to instantiate and run your connector. These include all the files in the <connector_name>/ directory. You can start by copying the files from `aave/` into `<connector_name>/`. Then you need to modify each file to fit your connector.

* `local.yaml`
* `manifest.yaml`
* `types.ts`
* `<connector_name>.ts`

`local.yaml`: This is the configuration file containing the rpc urls which are needed to retrieve data from the
blockchain. You’ll need it to run and test your connector locally.

`manifest.yaml`: This contains info about the connector name, author, version etc… Name should be <
connector_name>, author is `nakji`, and the version is `0.0.0`.

`types.ts`: This defines the maps used by `main.ts`. TopicTypes maps from string to protobuf format structs defined in <contract_name>_pb.ts. The string keys should be all lowercase, with the format `<author>.<connector_name>.<version>.<contract_name>_<event_name>`. The struct values should match the names of structs in `<contract_name>_pb.ts`. ABIs maps from <contract_name> to the ABI variable in `<contract_name>.abi.json`.

`<connector_name>.ts`: This defines the start and parse functions that the connector uses during runtime to start
receiving and unpacking messages. You can copy the code from `aave.ts`, changing the contract name to your specific
contract.

#### 5. Create main executable

Now we just need to create the `main.ts` file in `<connector_name>/cmd/<connector_name>/`. This is the main executable which handles starting and running the connector, as well as receiving user flags for backfill. Copy the code from `aave/cmd/main.ts`, changing the contract name. You also need to change the network name in the config to the chain your contract is deployed on. Congrats! You just built your first connector.

#### 6. Run a connector locally

You should now be able to run your connector locally without any additional steps. From your terminal, go into <connector_name>/ and run

First, spin up kafka by running:

```shell
docker-compose up -d
```

Now start the connector locally by running the `main.ts` file. (If you are running to “connection refused” error, make sure docker is running)

```shell
ts-node cmd/aave/main.ts
```

If your connector is functioning correctly, you should see the terminal continuously output some log like header
received block=20889028 network=ethereum ts=1661846917 , indicating that the connector is successfully receiving the
current block number.

Next, check that your connector is receiving live events. Leave your connector running, go back to the webpage on the blockchain explorer for your smart contract, and navigate to the "events" tab (next to the "contracts" tab). It lists live events as they come in, so refresh the page every once in a while.

Hover over the timestamp for a new event in the webpage. In the terminal where your connector is running, you should see a log like “Delivered message key= offset=257 partition=0 topic=dev.fct.nakji.aave.0_0_0.LIQUIDITYPOOL_Borrow” followed by "successfully committed transactions". Check that the timestamp of this log matches the timestamp for the event in the webpage. This means that your connector has successfully received the event, and committed the data as a message into Kafka.

Leave your connector running for a while. If the logs outputted by your connector all match the new events on the online explorer, then your connector is working as intended. 
