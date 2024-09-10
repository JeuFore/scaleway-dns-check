import 'dotenv/config'
import { createClient, Domain } from '@scaleway/sdk'
import fetch from 'node-fetch'
import tracer from 'tracer'

const logger = tracer.console({
    format: process.env.LOG_LEVEL === 'debug' ? "{{timestamp}} <{{title}}> {{message}} (in {{file}}:{{line}})" : "{{timestamp}} <{{title}}> {{message}}",
    preprocess: function (data) {
        data.title = data.title.toUpperCase();
    },
    level: process.env.LOG_LEVEL || 'info',
});

let IPS: string[] = []
try {
    IPS = JSON.parse(process.env.IPS || '[]')

    if (!IPS.length)
        throw new Error('No IPs provided')
} catch (error) {
    throw new Error('No IPs provided')
}

let RECORDS: string[] = []
try {
    RECORDS = JSON.parse(process.env.RECORDS || '[]')

    if (!RECORDS.length)
        throw new Error('No records provided')
} catch (error) {
    throw new Error('No records provided')
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
    }, 1000);

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
    } catch (error) {
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