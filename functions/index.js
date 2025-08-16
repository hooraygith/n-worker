
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
        const response = await customFetch(target)
        const bodyBuffer = await response.arrayBuffer()

        // --- 开始修改 ---

        // 先设置状态码 (writeHead 会用到)
        res.statusCode = response.status

        // 复制并过滤头部
        const headers = Object.fromEntries(response.headers.entries())
        const headersToRemove = [
            'content-length', 'Content-Length', 'transfer-encoding', 'Transfer-Encoding',
            'connection', 'Connection', 'keep-alive', 'upgrade',
            'proxy-authenticate', 'proxy-authorization', 'te', 'trailers'
        ]
        headersToRemove.forEach(header => delete headers[header])

        // 手动设置所有过滤后的头部
        Object.keys(headers).forEach(headerName => {
            res.setHeader(headerName, headers[headerName])
        })

        // **关键: 手动设置 Content-Length**
        // res.setHeader('Content-Length', bodyBuffer.byteLength)

        // **关键: 写入头部信息 (此后不能再修改头部)**
        res.writeHead(response.status)

        // **关键: 使用 res.end() 发送数据**
        res.end(Buffer.from(bodyBuffer))

        // --- 修改结束 ---

    } catch (error) {
        console.error(`Failed to process request for ${target}:`, error)
        res.status(502).send({ error: 'Bad Gateway: Failed to fetch the target URL after multiple retries' })
    }
}