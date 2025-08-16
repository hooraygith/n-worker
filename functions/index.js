// functions/test-size.js

export default async (req, res) => {
    // 1. 从查询参数中获取大小（单位：KB）
    //    我们继续使用 'url' 作为参数名，以匹配您的示例
    const sizeInKBStr = req.query.url
    const sizeInKB = parseInt(sizeInKBStr, 10)

    // 2. 验证输入是否为有效的正数
    if (isNaN(sizeInKB) || sizeInKB <= 0) {
        return res.status(400).send({
            error: 'Query parameter "url" must be a valid positive number representing the desired size in KB.'
        })
    }

    // 3. 计算总大小（单位：字节）
    //    1 KB = 1024 bytes
    const sizeInBytes = sizeInKB * 1024

    try {
        // 4. 在内存中创建一个指定大小的 Buffer (数据块)
        //    我们用字符 'a' 来填充它
        const dataBuffer = Buffer.alloc(sizeInBytes, 'a')

        // 5. 设置响应头并发送 Buffer
        //    Content-Type 设为纯文本，方便查看
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')

        //    当使用 res.send(buffer) 时，框架会自动计算并添加正确的 Content-Length 头
        res.status(200).send(dataBuffer)

    } catch (error) {
        // 如果请求的大小过大，Buffer.alloc 可能会失败
        console.error(`Failed to allocate buffer of size ${sizeInBytes} bytes:`, error)
        res.status(500).send({
            error: `Failed to generate content of size ${sizeInKB} KB. The requested size might be too large for the function's memory.`,
            requestedBytes: sizeInBytes
        })
    }
}