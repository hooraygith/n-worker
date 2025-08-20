import axios from 'axios'

export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        const response = await axios.get(target, {
            responseType: 'arraybuffer',
            timeout: 5000,
            decompress: false
        })

        const headers = response.headers
        delete headers['content-length']
        delete headers['transfer-encoding']

        res.status(response.status).send(response.data)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        const status = error.response ? error.response.status : 502
        res.status(status).send({ error: 'Bad Gateway: Failed to fetch the target URL.' })
    }
}