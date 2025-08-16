// functions/proxy.js (或者 index.js)

import axios from 'axios'

export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        const response = await axios.get(target, {
            responseType: 'stream',
            timeout: 5000,
            decompress: false
        })

        // --- 最终的关键修复 ---
        // 在将响应头写入客户端之前，删除 Content-Length。
        // 这会强制服务器使用 Transfer-Encoding: chunked，从而绕过 Nhost 的 Bug。
        const headers = response.headers
        delete headers['content-length']
        // --------------------

        res.writeHead(response.status, headers)

        response.data.pipe(res)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        const status = error.response ? error.response.status : 502
        res.status(status).send({ error: 'Bad Gateway: Failed to fetch the target URL.' })
    }
}