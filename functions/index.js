// functions/proxy.js (或者 index.js)

import { Readable } from 'stream'

/**
 * 您原来的 customFetch 函数，无需任何改动。
 * 它已经支持超时、重试和传递自定义 fetch 选项（比如 headers）。
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
 * Nhost 函数的主处理程序
 */
export default async (req, res) => {
    const target = req.query.url

    if (!target) {
        return res.status(404).send({ error: 'Not Found' })
    }

    try {
        // 1. 调用 customFetch，并传入关键的 headers 选项
        const response = await customFetch(target)

        // 2. 将目标服务器的响应头和状态码原样返回
        //    这将自动生成 Transfer-Encoding: chunked，绕过平台Bug
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()))

        // 3. 将 fetch 返回的 Web Stream 转换为 Node.js Stream 并“管道”到响应中
        Readable.fromWeb(response.body).pipe(res)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error.message)
        res.status(502).send({ error: 'Bad Gateway: Failed to fetch the target URL after multiple retries.' })
    }
}