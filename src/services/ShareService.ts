export function generateLetterShareImage(options: {
  title: string;
  body: string;
  referralCode: string;
}): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, '#f4e7cf');
  gradient.addColorStop(1, '#e7d2aa');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#8a6e4d';
  ctx.fillRect(70, 70, canvas.width - 140, canvas.height - 140);
  ctx.fillStyle = '#f7edd9';
  ctx.fillRect(90, 90, canvas.width - 180, canvas.height - 180);

  ctx.fillStyle = '#3f2d1d';
  ctx.font = 'bold 54px serif';
  ctx.fillText('MERGE MANOR', 130, 220);
  ctx.font = '32px serif';
  ctx.fillText('LETTERS FROM TOMORROW', 130, 270);

  ctx.font = 'bold 44px serif';
  ctx.fillText(options.title, 130, 390);

  ctx.font = '36px serif';
  const wrapWidth = 820;
  const words = options.body.split(' ');
  let line = '';
  let y = 460;
  for (const word of words) {
    const test = `${line}${word} `;
    const width = ctx.measureText(test).width;
    if (width > wrapWidth) {
      ctx.fillText(line, 130, y);
      y += 52;
      line = `${word} `;
    } else {
      line = test;
    }
  }
  if (line.trim().length > 0) {
    ctx.fillText(line, 130, y);
  }

  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = '#5b452d';
  ctx.fillText('Download and play!', 130, 1650);
  ctx.font = '30px monospace';
  ctx.fillText(`Referral: ${options.referralCode}`, 130, 1710);
  ctx.globalAlpha = 0.2;
  ctx.font = 'bold 90px serif';
  ctx.fillText('MM-LFT', 640, 1830);

  return canvas.toDataURL('image/png');
}
