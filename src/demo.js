export const demoPaper = {
  id:'paperlens-demo-transformer', filename:'Attention Is All You Need · 阅读示例', type:'demo', size:0,
  createdAt:Date.now() - 3600000, updatedAt:Date.now(), favorite:false, read:false, notes:'', chat:[],
  source:'https://arxiv.org/abs/1706.03762',
  visualsVersion:2,
  visuals:[
    {id:'demo-architecture',label:'Figure 1 · Transformer 模型架构',source:'sample',page:null,dataUrl:'/samples/transformer-architecture.png',attribution:'Vaswani et al., Attention Is All You Need · Figure 1'},
    {id:'demo-scaled-attention',label:'Figure 2a · 缩放点积注意力',source:'sample',page:null,dataUrl:'/samples/scaled-dot-attention.png',attribution:'Vaswani et al., Attention Is All You Need · Figure 2 (left)'},
    {id:'demo-multi-head',label:'Figure 2b · 多头注意力',source:'sample',page:null,dataUrl:'/samples/multi-head-attention.png',attribution:'Vaswani et al., Attention Is All You Need · Figure 2 (right)'}
  ],
  pages:[{ number:1, text:'Attention Is All You Need\nAshish Vaswani et al. · 2017\n\n阅读示例 / Reading sample\n\nTransformer 使用注意力机制构建序列转换模型。在 WMT 2014 英德、英法翻译任务中评估翻译质量与训练成本。\n\n本页展示经过整理的示例解读。完整论文请通过「查看公开原文」阅读。' }],
  analysis:{
    title:'Attention Is All You Need', authors:'Ashish Vaswani et al.', year:'2017', venue:'arXiv:1706.03762', doi:'10.48550/arXiv.1706.03762', language:'English', tags:['深度学习','自然语言处理','Transformer'], mode:'demo',
    summary:'Transformer 以注意力机制构建编码器与解码器，在机器翻译任务中兼顾翻译质量与训练并行性。论文将模型结构、计算路径和翻译实验连接起来，说明纯注意力架构的可行性。',
    question:'怎样缩短序列建模的计算路径，并提高训练并行性？',
    method:'多头注意力结合前馈网络与位置编码，构成编码器和自回归解码器。',
    conclusion:'在论文评估的机器翻译任务上，Transformer 取得较高翻译质量。',
    innovations:[
      { title:'以注意力构建序列转换架构', description:'编码器与解码器通过注意力机制建立序列依赖。', page:null },
      { title:'多头注意力', description:'在多个表示子空间中并行计算注意力。', page:null },
      { title:'位置编码', description:'在输入表示中加入序列位置信息。', page:null }
    ],
    results:[{ title:'机器翻译', description:'英德任务达到 28.4 BLEU；英法任务在摘要与表 2 中报告为 41.8 BLEU。', page:null }],
    figures:[
      { label:'Figure 1', title:'Transformer 模型架构', description:'说明编码器与解码器之间的信息流。', page:null, kind:'figure' },
      { label:'Figure 2', title:'注意力机制', description:'解释缩放点积注意力与多头注意力的组成。', page:null, kind:'figure' },
      { label:'Table 2', title:'翻译质量与训练成本', description:'对照机器翻译的实验表现。', page:null, kind:'table' }
    ],
    datasets:[{ name:'WMT 2014 · English–German', description:'机器翻译基准', size:'', task:'英德翻译', page:null },{ name:'WMT 2014 · English–French', description:'机器翻译基准', size:'', task:'英法翻译', page:null }],
    logic:[{ label:'研究问题', detail:'训练并行性与长距离依赖', page:null },{ label:'方法设计', detail:'注意力架构与位置编码', page:null },{ label:'实验证据', detail:'机器翻译质量与训练成本', page:null },{ label:'研究结论', detail:'纯注意力序列模型的可行性', page:null }],
    limitations:[{ title:'自注意力的计算规模', description:'完整自注意力的复杂度随序列长度呈二次增长。', page:null }]
  }
};
