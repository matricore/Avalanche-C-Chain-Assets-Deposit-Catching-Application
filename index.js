const Web3 = require('web3')
var dotenv = require('dotenv').config();
const TOKEN_ABI = require('./abi');
var Big = require('big.js');
var moment = require('moment');

var net = require('net');
var redis = require('redis');
var rclient = redis.createClient();

var server = net.createServer(function(socket) {});
server.listen(process.env.PORT, '127.0.0.1');

// your vault addresses 
var vaultaccounts = [];

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// LOGGING ----------------------------------------------------------------------------------------------------------------------------
var transport = new (winston.transports.DailyRotateFile)({
    filename: 'logs/%DATE%.log',
    datePattern: 'YYYYMMDD',
    zippedArchive: true,
    maxSize: '20m',
});

const logger = winston.createLogger({
  transports: [
    transport
  ]
});
// EOF LOGGING ------------------------------------------------------------------------------------------------------------------------

const web3options = {
  reconnect: {
      auto: true,
      delay: 5000,
      maxAttempts: 5,
      onTimeout: false
  }
};

const web3 =  new Web3(new Web3.providers.WebsocketProvider(process.env.WS_URL,web3options));

var watchUSDTTxs = {

    subscribe: null,
    event:null,
    start: async function() {

        // Instantiate token contract object with JSON ABI and address
        this.subscribe = new web3.eth.Contract(TOKEN_ABI, process.env.CONTRACT_ADDRESS,(error, result) => { 
          if (error)  { 
            console.log(error + moment().format('YYYY-MM-DD HH:mm:ss'));
            logger.info("subscribe error => " + error + " on=> " +  moment().format('YYYY-MM-DD HH:mm:ss'));
            return;
          }
        });

        // Generate filter options
        const options = {
          fromBlock: 'latest'
        }

        // Subscribe to Transfer events matching filter criteria
        this.event = this.subscribe.events.Transfer(options, async (error, event) => {

          if (error) {
            console.log(error);
            logger.info("this.subscribe.events.Transfer error => " + error + " on=> " +  moment().format('YYYY-MM-DD HH:mm:ss'));
            return;
          }
          if (process.env.DEMO_MODE == "1") {
            console.log(event.transactionHash);
          }
          else {
            checkIsMine(event);
          }

        })

    },
    stop: function() {
        this.event.unsubscribe(response => console.log("uns" + response));
    }


};

watchUSDTTxs.start();

async function checkIsMine (event) {

    try {

        if (event === null || !event.hasOwnProperty('returnValues')) return;
        if (!event.hasOwnProperty('transactionHash') || event.transactionHash === null) return;
        if (!event.returnValues.hasOwnProperty('_to') || event.returnValues._to === null) return;
        if (!event.returnValues.hasOwnProperty('_from') || event.returnValues._from === null) return;
        if (!event.returnValues.hasOwnProperty('_value') || event.returnValues._value === null) return;
        

        // stop if to field contains any of your vault address
        if (vaultaccounts.indexOf(event.returnValues._to.toLowerCase()) > -1) return;
        // stop if from field contains any of your vault address
        if (vaultaccounts.indexOf(event.returnValues._from.toLowerCase()) > -1) return;

        // get your addresses
        var accounts = await web3.eth.getAccounts();
        if (accounts.indexOf(event.returnValues._to) > -1) {

           if (event.hasOwnProperty("removed") && event.removed) {
                del(event.transactionHash); 
                return;
           } 

           var cf = new Big(event.returnValues._value);
           var amountx = Number(cf.div(1000000));
           set(event.transactionHash,event.returnValues._to,amountx);
           return;

        }

    }
    catch(error) {
      console.log("checkIsMine error " + error);
      return;
    }

}

async function del(key) {

    rclient.hdel("nusdt_transactions", key, function(err, reply) {

        if (err) {
          console.log(err);
          logger.info("error at redis set => " + moment().format('YYYY-MM-DD HH:mm:ss') + " - " + err);
          return;
        }

        console.info("removed usdt_tx deleted txid=> " + key + " at => " + moment().format('YYYY-MM-DD HH:mm:ss'));
        logger.info("removed usdt_tx deleted txid=> " + key + " at => " + moment().format('YYYY-MM-DD HH:mm:ss'));
        return;

    });
}

async function set(key,value,amount) {

    rclient.hset("nusdt_transactions", key, value, function(err, reply) {

        if (err) {
          console.log(err);
          logger.info("error at redis set => " + moment().format('YYYY-MM-DD HH:mm:ss') + " - " + err);
          return;
        }

        console.info("related usdt_tx recorded txid=> " + key + " at => " + moment().format('YYYY-MM-DD HH:mm:ss'));
        logger.info("related usdt_tx recorded txid=> " + key + " at => " + moment().format('YYYY-MM-DD HH:mm:ss'));

        // do something with these informations below
        // you have address, amount and transaction id         
        // for example send a message to your customer that he have a new unconfirmed token (usdt) transaction 

        return;


    });

}