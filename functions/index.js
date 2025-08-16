
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
        return res.status(404).send('Not found')
    }

    try {

        // 1. 使用 customFetch 获取目标响应对象
        const response = await customFetch(target)

        // 2. 将整个响应体读入内存，存为一个 ArrayBuffer
        const bodyBuffer = await response.arrayBuffer()

        // 3. 先设置状态码
        res.status(response.status)

        // 4. 复制目标服务器的响应头并过滤不兼容的头部
        const headers = Object.fromEntries(response.headers.entries())
        const headersToRemove = [
            'content-length',
            'Content-Length',
            'transfer-encoding',
            'Transfer-Encoding',
            'connection',
            'Connection',
            'keep-alive',
            'upgrade',
            'proxy-authenticate',
            'proxy-authorization',
            'te',
            'trailers'
        ]
        headersToRemove.forEach(header => delete headers[header])

        res.set(headers)

        // 2. 手动设置 Content-Length
        //    这是 res.end() 不会自动做的事情
        res.setHeader('Content-Length', bodyBuffer.byteLength)

        // 3. 写入状态码和头部信息
        //    writeHead 会将所有已设置的头部信息立即发送给客户端
        res.writeHead(response.status)

        // 4. 发送数据并结束响应
        res.end(Buffer.from(bodyBuffer))

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error)
        res.status(502).send({ error: 'Bad Gateway: Failed to fetch the target URL after multiple retries' })
    }
}