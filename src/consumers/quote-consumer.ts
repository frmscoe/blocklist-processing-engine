import * as kafka from 'kafka-node';
import { isBlocked } from "../redis-client/redis-client";
import { log, sanitizeNumber } from '../helper';

const handleMessage = async (message: kafka.Message, topic: string, handleBlock: (msisdn: string, topic: string, isBlocked: number) => any) => {
    const msisdns = getMSISDNs(message.value.toString());
    let promises: Promise<any>[] = [];

    msisdns.forEach(msisdn => {
        promises.push(new Promise(async resolve => {
            const blocked = await isBlocked(msisdn);
            await handleBlock(msisdn, topic, blocked);
            resolve();
        }));
    });
    await Promise.all(promises);
}

const getMSISDNs = (message: string): string[] => {
    const jMessage = JSON.parse(message);
    return [
        sanitizeNumber(jMessage.payer.partyIdInfo.partyIdentifier),
        sanitizeNumber(jMessage.payee.partyIdInfo.partyIdentifier)
    ]
}

export { handleMessage }