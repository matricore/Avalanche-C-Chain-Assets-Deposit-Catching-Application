const Web3 = require('web3')
var redis = require('redis');
var rclient = redis.createClient();
var dotenv = require('dotenv').config();
var Queue = require('bull');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
var moment = require('moment');
var net = require('net');
var Big = require('big.js');

var server = net.createServer(function(socket) {});
server.listen(process.env.CONFIRMATION_PORT, '127.0.0.1');

const web3options = {
  reconnect: {
      auto: true,
      delay: 5000,
      maxAttempts: 5,
      onTimeout: false
  }
};

const web3 =  new Web3(new Web3.providers.WebsocketProvider(process.env.WS_URL,web3options));

// LOGGING ----------------------------------------------------------------------------------------------------------------------------
var transport = new (winston.transports.DailyRotateFile)({
    filename: 'logs/confirmation/%DATE%.log',
    datePattern: 'YYYYMMDD',
    zippedArchive: true,
    maxSize: '20m'
  });

const logger = winston.createLogger({
  transports: [
    transport
  ]
});
// EOF LOGGING ------------------------------------------------------------------------------------------------------------------------


const usdtConfirmQueue = new Queue('usdtConfirmQueue');
usdtConfirmQueue.empty();
console.log("started with => " + " usdtConfirmQueue");

// Define a local completed event
usdtConfirmQueue.on('completed', (job, result) => {
  console.log("job completed=> " + job.id + " at=> " + moment().format('YYYY-MM-DD HH:mm:ss'));
  job.remove();
})

usdtConfirmQueue.on('error', (error) => {
    logger.info("usdtConfirmQueue error => " + error);
})

usdtConfirmQueue.on('failed', (job, result) => {
  console.log("usdtConfirmQueue Job failed! => " + job.id);
  logger.info("usdtConfirmQueue Job failed! => " + job.id);
  job.remove();
})

usdtConfirmQueue.on('stalled', (job, result) => {
  console.log("usdtConfirmQueue Job stalled! Job id => " + job.id);
  logger.info("usdtConfirmQueue Job stalled! Job ID => " + job.id);
  job.remove();
})

usdtConfirmQueue.process(async (job,done) => {
  getusdttxs(job,done);
});

// usdtConfirmQueue.add();
usdtConfirmQueue.add({}, {repeat: {cron: '* * * * *'}});


async function getusdttxs(job,done) {

    rclient.hgetall("usdt_transactions", function(err, reply) {

      if (err) {
        console.log("confirmationchecker redis error => " + err);
        logger.info("confirmationchecker redis error => " + err);
        done();
      }
      if (reply == null || Object.keys(reply).length < 1) {
        console.log("confirmationchecker redis key empty");
        logger.info("confirmationchecker redis key empty");
        done();
      }
      else {
          logger.info("how many txs => " + Object.keys(reply).length);
          console.log("how many txs => " + Object.keys(reply).length);

          for (var i = 0; i < Object.keys(reply).length; i++) {

            getConfirmations(Object.keys(reply)[i]);

          }         

          console.log("confirmation checker ended at => " + moment().format('YYYY-MM-DD HH:mm:ss'));
          logger.info("confirmation checker ended at => " + moment().format('YYYY-MM-DD HH:mm:ss'));
          done();       
      }
    });
}

async function getConfirmations(txHash) {

  try {

        const trx = await web3.eth.getTransaction(txHash);
        const currentBlock = await web3.eth.getBlockNumber();

        if (trx === null || !trx.hasOwnProperty('blockNumber') || trx.blockNumber === null || currentBlock === null) {
          console.log("null trx " + txHash);
          logger.info("trx blog number missing " + moment().format('YYYY-MM-DD HH:mm:ss'));
          return;
        }
        else {

          var trxConfirmations = (currentBlock - trx.blockNumber);

          if (parseInt(trxConfirmations) > parseInt(process.env.MIN_CONFIRMATION) ) {

            console.log(trxConfirmations + " confirmation done yet " + txHash);

            const tokentrx = await web3.eth.getTransactionReceipt(txHash);

            var cf = new Big(web3.eth.abi.decodeParameter('uint256',tokentrx.logs[0].data));
            var amountx = Number(cf.div(1000000));

            rclient.hdel("usdt_transactions", txHash, function(err, del) {

              if (err) {
                console.log(err);
                logger.info("error getting redis key => " + err);
                return;
              }


              logger.info("usdt transactions removed from usdt_transactions => at=> " +  moment().format('YYYY-MM-DD HH:mm:ss') + " TXHASH=> " + txHash);

              var tokento = web3.eth.abi.decodeParameter('address',tokentrx.logs[0].topics[2]).toLowerCase();

              // you have address (tokento), amount (amountx), transaction id (txHash) and confirmation count (trxConfirmations)
              // do something 
              // for example send a message to your customer or address owner

           });         

          }
          else {
            console.log("confirmation below " + process.env.MIN_CONFIRMATION);
            logger.info("confirmation below " + process.env.MIN_CONFIRMATION + " => " + txHash);
            return;
          }
        }

  }
  catch (error) {
    console.log(error);
    logger.info("error => " + error);
    return;
  }

}


async function setToConfirmed(k,v) {

    try {

        rclient.hset("usdt_confirmed", k, v, function(err, reply) {

            if (err) {
              console.log(err);
              logger.info("error set to confirmed 2 redis => " + err);
              return;
            }

            console.info("usdt_tx recorded as confirmed " + k);
            logger.info("usd_tx recorded as confirmed " + k);
            return;

        });

    }
    catch(error) {
      console.log(error);
      logger.info(" settoconfirmed error => " + error);
      return;
    }
    

}
