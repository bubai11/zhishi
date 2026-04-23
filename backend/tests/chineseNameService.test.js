const test = require('node:test');
const assert = require('node:assert/strict');

const chineseNameService = require('../services/chineseNameService');

test('extractIPlantChineseNameFromHtml prefers spcname variable', () => {
  const html = `
    <html>
      <head><title>茶 Camellia sinensis|iPlant 植物智——植物物种信息系统</title></head>
      <body><script>var spcname = "茶";</script></body>
    </html>
  `;

  assert.equal(
    chineseNameService.extractIPlantChineseNameFromHtml(html, 'Camellia sinensis'),
    '茶'
  );
});

test('extractIPlantChineseNameFromHtml falls back to title parsing', () => {
  const html = `
    <html>
      <head><title>玉兰 Magnolia denudata|iPlant 植物智——植物物种信息系统</title></head>
      <body></body>
    </html>
  `;

  assert.equal(
    chineseNameService.extractIPlantChineseNameFromHtml(html, 'Magnolia denudata'),
    '玉兰'
  );
});

test('extractIPlantProfileFromHtml parses aliases and synonyms', () => {
  const html = `
    <html>
      <head><title>茶 Camellia sinensis|iPlant 植物智——植物物种信息系统</title></head>
      <body>
        <script>
          var spcname = "茶";
          var spno = "15492";
        </script>
        <div>茶(chá) Camellia sinensis 俗名：茶树、茗、大树茶 异名：Camellia arborescens Thea sinensis Thea viridis 名称分类</div>
      </body>
    </html>
  `;

  const profile = chineseNameService.extractIPlantProfileFromHtml(
    html,
    'Camellia sinensis',
    'https://www.iplant.cn/info/Camellia%20sinensis'
  );

  assert.equal(profile.chineseName, '茶');
  assert.equal(profile.externalId, '15492');
  assert.deepEqual(profile.aliases, ['茶树', '茗', '大树茶']);
  assert.deepEqual(profile.synonyms, ['Camellia arborescens', 'Thea sinensis', 'Thea viridis']);
});

test('extractIPlantLinkedScientificNamesFromHtml parses linked candidate names', () => {
  const html = `
    <html>
      <body>
        <a href="/info/Yulania%20denudata">accepted</a>
        <a href="/info/Magnolia%20denudata">self</a>
      </body>
    </html>
  `;

  assert.deepEqual(
    chineseNameService.extractIPlantLinkedScientificNamesFromHtml(html),
    ['Yulania denudata', 'Magnolia denudata']
  );
});

test('extractIPlantProfileFromHtml keeps accepted-name candidate links', () => {
  const html = `
    <html>
      <head><title>Magnolia denudata|iPlant 植物智——植物物种信息系统</title></head>
      <body>
        <div>注：名称已修订，正名是：<span><a href='/info/Yulania denudata'>玉兰 Yulania denudata</a></span></div>
      </body>
    </html>
  `;

  const profile = chineseNameService.extractIPlantProfileFromHtml(
    html,
    'Magnolia denudata',
    'https://www.iplant.cn/info/Magnolia%20denudata'
  );

  assert.deepEqual(profile.linkedScientificNames, ['Yulania denudata']);
  assert.deepEqual(profile.payload.linkedScientificNames, ['Yulania denudata']);
});
