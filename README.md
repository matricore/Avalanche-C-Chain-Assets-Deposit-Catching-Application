Avalanche C Chain Assets Deposit or Transfer Detecting Application

Requirements

1- Running Avalanche Node With C Chain Support (Please check https://docs.avax.network/build/tutorials/platform/integrate-exchange-with-avalanche/ )

2- Node.Js > 10

3- Locally Running Redis Server

Please change .env file "CONTRACT_ADDRESS" section with corresponding contract address. In this example We use USDT Native contract address. 
Also please change "DEMO_MODE" to "0" if you want to use in production mode. If "DEMO_MODE" is "1", application will log the transaction ids into the console.

Instructions

index.js connect web socket server and subscribe contracts events. if detects any related transactions it writes to the redis hashset.
confirmation.js checks the redis hashset and controls if transaction(s) has sufficient confirmations. It runs every minute for doing that checks.
