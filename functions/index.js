// functions/proxy.js  (或者 index.js)

import axios from 'axios'

export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        const response = await axios.get(target, {
            // 我们需要的是一个流
            responseType: 'stream',
            // 设置一个合理的超时，例如20秒
            timeout: 20000,
            // 伪装成浏览器，解决目标服务器的连接问题
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            },
            // 最佳实践：让浏览器自己处理解压
            decompress: false
        })

        // 将目标服务器的响应头和状态码原样返回
        // 因为是流，axios 不会设置 Content-Length，服务器会自动使用 chunked 编码
        res.writeHead(response.status, response.headers)

        // 将从目标服务器收到的数据流，直接“管道”到给用户的响应中
        response.data.pipe(res)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        // 检查是否能从错误中获取状态码
        const status = error.response ? error.response.status : 502
        res.status(status).send({ error: 'Bad Gateway: Failed to fetch the target URL.' })
    }
}