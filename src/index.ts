import 'dotenv/config'
import { createClient, Domain } from '@scaleway/sdk'
import fetch from 'node-fetch'
import tracer from 'tracer'
import { exec } from 'child_process'

const logger = tracer.console({
    format: process.env.LOG_LEVEL === 'debug' ? "{{timestamp}} <{{title}}> {{message}} (in {{file}}:{{line}})" : "{{timestamp}} <{{title}}> {{message}}",
    preprocess: function (data) {
        data.title = data.title.toUpperCase();
    },
    level: process.env.LOG_LEVEL || 'info',
});

let IPS: string[] = []
try {
    IPS = process.env.IPS?.split(',') || []

    if (!IPS.length)
        throw new Error('No IPs provided')
} catch (error) {
    throw new Error('No IPs provided')
}

let RECORDS: string[] = []
try {
    RECORDS = process.env.RECORDS?.split(',') || []

    if (!RECORDS.length)
        throw new Error('No records provided')
} catch (error) {
    throw new Error('No records provided')
}

let APPRISE_URLS: string[] = []
try {
    APPRISE_URLS = process.env.APPRISE_URLS?.split(',') || []
} catch (error) {
    throw new Error('No APPRISE_URLS provided')
}

const DNS_ZONE = process.env.DNS_ZONE
if (!DNS_ZONE)
    throw new Error('No DNS_ZONE provided')

const client = createClient({
    accessKey: process.env.ACCESS_KEY,
    secretKey: process.env.SECRET_KEY,
    defaultProjectId: process.env.PROJECT_ID,
    defaultRegion: process.env.REGION,
    defaultZone: process.env.ZONE,
})
const api = new Domain.v2beta1.API(client)

const checkIpHealthCheck = async (ip: string): Promise<boolean> => {
    logger.info(`Checking health of ${ip}`)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, process.env.HEALTH_CHECK_TIMEOUT ? parseInt(process.env.HEALTH_CHECK_TIMEOUT) : 2000);

    return new Promise((resolve) => {
        fetch(`http://${ip}:${process.env.HEALTH_CHECK_PORT || 80}`, { signal: controller.signal })
            .then((res: any) => resolve(res.statusText === 'OK'))
            .catch(() => resolve(false))
            .finally(() => clearTimeout(timeout))
    })
}

const findHealthIp = async (): Promise<string> => {
    logger.info('Finding health IP')
    let findIp: string = ''
    for await (const ip of IPS) {
        if (!findIp && await checkIpHealthCheck(ip))
            findIp = ip
    }

    logger.info(`Health IP found: ${findIp}`)
    return findIp
}

const sendAppriseNotification = async (message: string): Promise<void> => {
    if (!APPRISE_URLS.length) {
        logger.warn('No APPRISE_URLS provided, skipping notification')
        return
    }

    const urls = APPRISE_URLS.join(' ')

    exec(`apprise -i markdown -n warning -t "### Scaleway DNS Check" -b "${message}" ${urls}`, (error, _stdout, stderr) => {
        if (error) {
            logger.error(`Error sending notification: ${error.message}`)
            return
        }
        if (stderr) {
            logger.error(`Error sending notification: ${stderr}`)
            return
        }
        logger.info("Notification sent")
    })
}

const updateDnsRecord = async (id: string, ip: string): Promise<void> => {
    try {
        logger.info(`Updating DNS record ${id} with IP ${ip}`)

        const { records } = await api.listDNSZoneRecords({
            dnsZone: DNS_ZONE,
            name: '',
            id
        })

        if (!records.length)
            throw new Error('No records found')

        if (records[0].data === ip) {
            logger.info(`DNS record ${id} already updated with IP ${ip}`)
            return
        }

        await api.updateDNSZoneRecords({
            dnsZone: DNS_ZONE,
            changes: [
                {
                    set: {
                        id,
                        records: [
                            {
                                ...records[0],
                                data: ip
                            }
                        ]
                    }
                }
            ],
            disallowNewZoneCreation: true
        })

        logger.info(`DNS record ${id} updated with IP ${ip}`)
        sendAppriseNotification(`DNS records updated with IP **${ip}**`)
    } catch (_e) {
        logger.error(`Error updating DNS record ${id} with IP ${ip}`)
    }
}

const start = async () => {
    const ip = await findHealthIp()

    if (!ip) {
        logger.error('No healthy IP found')
        return
    }

    for await (const record of RECORDS) {
        await updateDnsRecord(record, ip)
    }

    logger.info('DNS records updated')
}

start()

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown:', error);
});