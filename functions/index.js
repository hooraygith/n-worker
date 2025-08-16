// functions/proxy.js

import { Readable } from 'stream'

/**
 * 带有重试和超时逻辑的 fetch 函数。
 */
async function customFetch(url, options = {}) {
    const { retry = 3, timeout = 5000, ...fetchOptions } = options

    for (let i = 0; i < retry + 1; i++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            })
            clearTimeout(timeoutId)
            return response
        } catch (error) {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
                console.error(`Request to ${url} timed out.`)
            }
            if (i < retry) {
                console.log(`Request to ${url} failed. Retrying... (${i + 1}/${retry})`)
                await new Promise(res => setTimeout(res, 1000))
                continue
            }
            throw error
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retry} retries.`)
}

/**
 * Nhost 函数的主处理程序 (非流式版本)
 */
export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not found' })
    }

    try {
        console.log('--- EXECUTING NON-STREAMING VERSION V2 ---')
        // 1. 使用 customFetch 获取目标响应对象
        const response = await customFetch(target, { timeout: 10000 })

        // 2. 将整个响应体读入内存，存为一个 ArrayBuffer
        const bodyBuffer = await response.arrayBuffer()

        console.log(`--- V2: Downloaded ${bodyBuffer.byteLength} bytes into buffer. ---`)

        // 3. 复制目标服务器的响应头
        //    我们需要手动删除 content-length 和 transfer-encoding，
        //    因为服务器会根据我们发送的 Buffer 自动计算并添加正确的 Content-Length。
        // const headers = Object.fromEntries(response.headers.entries())
        // delete headers['content-length']
        // delete headers['transfer-encoding']

        // res.set(headers)

        // 4. 将状态码和内存中的 Buffer 发送给客户端
        res.status(response.status).send(Buffer.from(bodyBuffer))

    } catch (error) {
        console.error(`--- V2 ERROR IN NON-STREAMING VERSION: ---`, error)
        console.error(`Failed to process request for ${target}:`, error)
        res.status(502).send({ error: 'Bad Gateway: Failed to fetch the target URL after multiple retries' })
    }
}