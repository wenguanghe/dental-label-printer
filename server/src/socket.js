// Agent 连接状态
let agentSocket = null;
let agentStatus = { connected: false, printerName: null, printerOnline: false };
let printerList = [];

export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Agent 注册
    socket.on('agent_register', (data) => {
      agentSocket = socket;
      agentStatus = {
        connected: true,
        printerName: data.printerName || 'Unknown',
        printerOnline: data.printerOnline || false
      };
      // 存储打印机列表
      if (data.printers && Array.isArray(data.printers)) {
        printerList = data.printers;
      }
      console.log('Agent registered:', agentStatus);
      console.log('Printers:', printerList);
      // 广播 Agent 状态给所有前端
      io.emit('agent_status', { ...agentStatus, printers: printerList });
    });

    // Agent 状态更新
    socket.on('agent_status_update', (data) => {
      agentStatus = { ...agentStatus, ...data };
      io.emit('agent_status', { ...agentStatus, printers: printerList });
    });

    // Agent 返回打印机列表（刷新后）
    socket.on('printers_list', (data) => {
      if (data.printers && Array.isArray(data.printers)) {
        printerList = data.printers;
        console.log('Printers updated:', printerList);
        io.emit('agent_status', { ...agentStatus, printers: printerList });
      }
    });

    // Agent 打印完成回执
    socket.on('print_success', (data) => {
      console.log('Print success:', data);
      io.emit('print_result', { success: true, taskId: data.taskId });
    });

    // Agent 打印失败
    socket.on('print_error', (data) => {
      console.log('Print error:', data);
      io.emit('print_result', { success: false, taskId: data.taskId, error: data.error });
    });

    // 前端请求获取 Agent 状态
    socket.on('get_agent_status', () => {
      socket.emit('agent_status', { ...agentStatus, printers: printerList });
    });

    // 前端请求刷新打印机列表
    socket.on('refresh_printers', () => {
      if (agentSocket && agentStatus.connected) {
        agentSocket.emit('refresh_printers');
      }
    });

    // 前端设置打印机
    socket.on('set_printer', (data) => {
      if (agentSocket && agentStatus.connected) {
        agentSocket.emit('set_printer', { printerName: data.printerName });
        agentStatus.printerName = data.printerName;
        io.emit('agent_status', { ...agentStatus, printers: printerList });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (agentSocket && agentSocket.id === socket.id) {
        agentSocket = null;
        agentStatus = { connected: false, printerName: null, printerOnline: false };
        printerList = [];
        io.emit('agent_status', { ...agentStatus, printers: printerList });
        console.log('Agent disconnected');
      }
    });
  });
}

export function getAgentStatus() {
  return { ...agentStatus, printers: printerList };
}

export function sendPrintTask(io, taskData) {
  if (!agentSocket || !agentStatus.connected) {
    throw new Error('打印 Agent 未连接');
  }
  agentSocket.emit('print_task', taskData);
}
