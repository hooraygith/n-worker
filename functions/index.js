// functions/test-stream.js

import { Readable } from 'stream'

export default async (req, res) => {
    // 1. 创建一个 Node.js 的可读流
    const stream = new Readable({
        read() {} // 我们将手动推送数据
    })

    // 2. 设置响应头。注意，我们不设置 Content-Length
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('X-Test-Message', 'This is a pure internal stream test')
    res.writeHead(200)

    // 3. 将流“管道”连接到响应对象
    stream.pipe(res)

    // 4. 模拟数据分块到达，每 200 毫秒推送一块数据
    let count = 0
    const interval = setInterval(() => {
        count++
        const chunk = `This is chunk number ${count}...\n`
        console.log(`Pushing chunk: ${count}`)

        // 推送数据到流中
        stream.push(chunk)

        if (count >= 5) {
            clearInterval(interval)
            // 推送 null 来表示流的结束
            stream.push(null)
            console.log('Stream finished.')
        }
    }, 200)

    // 监听客户端连接断开的事件
    req.on('close', () => {
        console.log('Client closed connection.')
        clearInterval(interval)
        stream.destroy()
    })
}