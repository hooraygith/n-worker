// functions/hybrid-proxy.js

import axios from 'axios'
import { Readable } from 'stream'

export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        // --- 第 1 步: 完整下载外部数据到内存 ---
        console.log('Step 1: Fetching and buffering the entire file...')
        const response = await axios.get(target, {
            // 这里必须使用 arraybuffer 来获取完整内容
            responseType: 'arraybuffer',
            timeout: 5000,
        })
        const bodyBuffer = response.data // axios 在 responseType: 'arraybuffer' 时，data 就是一个 Buffer
        console.log(`Step 1 Complete: Downloaded ${bodyBuffer.byteLength} bytes.`)


        // --- 第 2 步: 将内存中的 Buffer 流式发送出去 ---
        console.log('Step 2: Streaming the buffered data to the client...')

        // 将原始的、正确的响应头写入
        res.writeHead(response.status, response.headers)

        // 创建一个可读流
        const readable = new Readable()
        // 将完整的 Buffer 推入流中
        readable.push(bodyBuffer)
        // 推送 null 表示流结束
        readable.push(null)

        // 将这个“人造”的流管道连接到响应中
        readable.pipe(res)

        console.log('Step 2 Complete: Piping finished.')

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        const status = error.response ? error.response.status : 502
        res.status(status).send({ error: 'Bad Gateway: Failed to fetch the target URL.' })
    }
}