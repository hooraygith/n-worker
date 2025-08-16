// functions/proxy.js

import { Readable } from 'stream'

/**
 * 带有重试和超时逻辑的 fetch 函数。
 * 这个函数与您提供的版本完全相同，无需修改。
 */
async function customFetch(url, options = {}) {
    const { retry = 3, timeout = 5000, retry_function, ...fetchOptions } = options

    for (let i = 0; i < retry + 1; i++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (retry_function) {
                const shouldRetry = await retry_function(response.clone())
                if (shouldRetry && i < retry) {
                    console.log(`Retry condition met for ${url}. Retrying... (${i + 1}/${retry})`)
                    await new Promise(res => setTimeout(res, 1000))
                    continue
                }
            }

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
 * 它接收 (req, res) 对象，类似于 Express.js
 */
export default async (req, res) => {
    // 1. 从查询参数中获取目标 URL
    const target = req.query.url

    if (!target) {
        // 如果缺少 url 参数，返回 400 错误
        return res.status(404).send({ error: 'Not found' })
    }

    try {
        // 2. 使用 customFetch 获取目标内容
        // 建议传递一些原始请求头，避免被目标网站屏蔽
        const response = await customFetch(target, {
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Nhost-Function-Proxy/1.0',
                'Accept': req.headers['accept'] || '*/*',
                'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            }
        })

        // 3. 将目标服务器的响应头和状态码设置到返回给客户端的响应中
        res.writeHead(response.status, Object.fromEntries(response.headers))

        // 4. 将响应体流式传输给客户端
        // response.body 是一个 Web Stream (ReadableStream)
        // res 是一个 Node.js Stream (ServerResponse)
        // Readable.fromWeb() 可以将它们连接起来进行管道传输
        Readable.fromWeb(response.body).pipe(res)

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error)
        // 在所有重试都失败后，返回一个服务器错误
        res.status(502).send({ error: 'Bad Gateway: Failed to fetch the target URL after multiple retries' })
    }
}