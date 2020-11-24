import * as kafka from 'kafka-node';
import { isBlocked } from "../redis-client/redis-client";
import { configObj } from '../config/config';

/**
* Subscribe to the configured Kafka server 
* to the selected Kafka topic
*/
const start = (topic: string, configuration: configObj) => {
    log('Starting Blocklist Processing Engine...', topic);
    try {
        let kafkaHost = configuration.kafkaEndpoint;
        let client = new kafka.KafkaClient({
            kafkaHost: kafkaHost
        });

        let consumer = new kafka.Consumer(
            client,
            [
                {
                    topic: topic,
                    partition: configuration.partition
                }
            ],
            {
                autoCommit: configuration.autoCommit
            }
        );

        consumer.on('message', async (message: kafka.Message) => {
            console.time('e2e processing time');
            return handleMessage(message, topic).then(() => console.timeEnd('e2e processing time'));
        })
        // .commit((error: any, data: any) => {
        //     if (error)
        //         log('Error while committing message: ' + error, topic);
        // });

        log('Started Blocklist Processing Engine.', topic);
    } catch (e) {
        log('Unhandled exception with details: ' + e, topic);
    }
}

const handleMessage = async (message: kafka.Message, topic: string) => {
    //log('New message received:\r\n' + message.value, topic);
    let msisdns = getMSISDNs(message.value.toString());
    let promises: Promise<any>[] = [];

    console.time('redis');
    msisdns.forEach(msisdn => {
        promises.push(new Promise(async resolve => {
            await isBlocked(msisdn).then(isBlocked => {
                if (isBlocked != 0) {
                    handleBlock(msisdn, topic);
                    resolve();
                }
                else {
                    handleNotBlock(msisdn, topic);
                    resolve();
                }
            });
        }));
    });
    await Promise.all(promises).then((values) => {
        console.timeEnd('redis');
        log('Message Processed ' + new Date().toISOString(), topic)
    });
}

const getMSISDN = (message: string): string => {
    // TODO parse message as json and get the msisdn
    let msisdn = sanitizeNumber(message);
    return msisdn;
}

const getMSISDNs = (message: string): string[] => {
    let toReturn: string[] = [];
    let jMessage = JSON.parse(message);
    toReturn.push(sanitizeNumber(jMessage.payer.partyIdInfo.partyIdentifier));
    toReturn.push(sanitizeNumber(jMessage.payee.partyIdInfo.partyIdentifier));
    return toReturn;
}

const handleBlock = (msisdn: string, topic: string) => {
    // Raise error to Score Engine
    log(msisdn + " is blocked!", topic);
}

const handleNotBlock = (msisdn: string, topic: string) => {
    // Who knows. Raise no error? 
    log(msisdn + " is not blocked.", topic);
}

/**
 * Makes sure the MSISDN starts with +233
 */
const sanitizeNumber = (number: string): string => {
    if (number.startsWith('0')) {
        number = number.substring(1);
        number = '+233' + number;
    } else if (!number.startsWith('+'))
        number = '+' + number;
    return number;
}

/** Logs the provided message */
const log = (message: string, topic: string) => {
    // TODO find a proper logger
    //console.log('[' + topic + '] ' + message);
}


export default start;
