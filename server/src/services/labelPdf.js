import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_PATH = join(__dirname, '../../fonts/NotoSansSC.ttf');

const LABEL_CONFIG = {
  width: 113,
  height: 85,
  padding: 4,
};

function formatDateTime(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${h}:${min}`;
}

// 数字转字母: 1→A, 2→B, ... 26→Z, 27→AA
function batchToLetter(n) {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export async function generateLabelPdf(task) {
  const doc = new PDFDocument({
    size: [LABEL_CONFIG.width, LABEL_CONFIG.height],
    margin: 0,
    autoFirstPage: false
  });
  doc.registerFont('CN', FONT_PATH);

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const { width, height, padding } = LABEL_CONFIG;
  const textWidth = width - padding * 2;

  // 解析炉号和炉次（格式: "1号炉|A" 或旧格式 "1号炉 第9炉次"）
  let furnaceName = '';
  let furnaceBatch = '';
  if (task.furnaceNo) {
    if (task.furnaceNo.includes('|')) {
      const parts = task.furnaceNo.split('|');
      furnaceName = parts[0];
      furnaceBatch = parts[1];
    } else {
      furnaceName = task.furnaceNo;
    }
  }

  for (const item of task.items) {
    for (let q = 0; q < item.quantity; q++) {
      doc.addPage({ size: [width, height], margin: 0 });

      // 器械名称（大字居中）
      doc.fontSize(10).font('CN').text(item.instrumentName, padding, padding + 2, {
        width: textWidth, align: 'center', lineBreak: false
      });

      // 分隔线
      const lineY = padding + 16;
      doc.moveTo(padding + 4, lineY).lineTo(width - padding - 4, lineY)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke();

      // 消毒时间
      doc.fontSize(6.5).font('CN').text(`消毒时间: ${formatDateTime(task.sterilizeTime)}`, padding, lineY + 3, {
        width: textWidth, lineBreak: false
      });
      // 失效时间
      doc.fontSize(6.5).font('CN').text(`失效时间: ${formatDateTime(task.expireTime)}`, padding, lineY + 13, {
        width: textWidth, lineBreak: false
      });
      // 消毒人员
      doc.fontSize(6.5).font('CN').text(`消毒人员: ${task.sterilizerName}`, padding, lineY + 24, {
        width: textWidth, lineBreak: false
      });
      // 核对人员
      doc.fontSize(6.5).font('CN').text(`核对人员: ${task.checkerName}`, padding, lineY + 34, {
        width: textWidth, lineBreak: false
      });
      // 炉号（单独一行）
      if (furnaceName) {
        doc.fontSize(6.5).font('CN').text(`炉号: ${furnaceName}`, padding, lineY + 44, {
          width: textWidth, lineBreak: false
        });
      }
      // 炉次（单独一行，英文字母）
      if (furnaceBatch) {
        doc.fontSize(6.5).font('CN').text(`炉次: ${furnaceBatch}`, padding, lineY + 54, {
          width: textWidth, lineBreak: false
        });
      }
    }
  }

  const pdfPromise = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
  });
  doc.end();
  return pdfPromise;
}
