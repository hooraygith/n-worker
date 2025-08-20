import axios from 'axios'

export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        // 将 responseType 从 'stream' 更改为 'arraybuffer'
        // 这会告诉 axios 等待整个响应下载完成并将其作为缓冲区返回
        const response = await axios.get(target, {
            responseType: 'arraybuffer',
            timeout: 5000,
            decompress: false
        })

        const headers = response.headers
        // 让 serverless 环境根据缓冲区的大小自动设置正确的 content-length
        delete headers['content-length']
        // 流式传输常用的 transfer-encoding 头也应被删除
        delete headers['transfer-encoding']

        res.status(response.status).send(response.data)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        const status = error.response ? error.response.status : 502
        res.status(status).send({ error: 'Bad Gateway: Failed to fetch the target URL.' })
    }
}