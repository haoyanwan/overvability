#!/bin/bash

# 1. 启动 Backend (Python)
# > /dev/null 丢弃标准输出，2>&1 丢弃错误输出
echo "正在静默启动后端服务..."
cd backend && nohup python3.9 app.py > /dev/null 2>&1 &
cd ..

# 2. 启动 Frontend (Vite)
echo "正在静默启动前端服务..."
nohup npm run devl:frontend > /dev/null 2>&1 &

echo "------------------------------------------------"
echo "所有服务已在后台运行，不记录任何日志。"
echo "可以使用 'ps -ef | grep python' 或 'ps -ef | grep vite' 查看进程。"
echo "------------------------------------------------"