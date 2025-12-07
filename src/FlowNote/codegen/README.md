# Code Generation Module

代码生成模块，负责将 FlowNote 节点转换为 Python 代码。

## 架构

```
codegen/
├── CodeBuilder.ts          # 代码构建器（Builder 模式）
├── PythonFormatter.ts      # Python 值格式化工具
├── NodeCodeGenerator.ts    # 节点代码生成器
├── CellUpdater.ts          # Cell 更新器
└── index.ts                # 模块导出
```

## 职责划分

### CodeBuilder
使用 Builder 模式构建 Python 代码，提供链式调用接口。

```typescript
const builder = new CodeBuilder();
builder
  .addComment('Load data')
  .addImport('import pandas as pd')
  .addAssignment('df', "pd.read_csv('data.csv')")
  .build();
```

### PythonFormatter
负责将 JavaScript 值转换为 Python 代码字符串。

```typescript
PythonFormatter.formatValue(true);           // 'True'
PythonFormatter.formatValue([1, 2, 3]);      // '[1, 2, 3]'
PythonFormatter.isBareIdentifier('df_out');  // true
```

### NodeCodeGenerator
根据节点 schema 和参数值生成完整的 Python 代码。

```typescript
const generator = new NodeCodeGenerator(schema, values, serverRoot);
const code = generator.generate();
```

### CellUpdater
负责查找和更新 Notebook Cell 的源代码，处理连线引用。

```typescript
const updater = new CellUpdater(notebook, serverRoot);
updater.updateCellForNode(nodeId);
```

## 使用方式

```typescript
import { NodeCodeGenerator, CellUpdater } from './codegen';

// 生成代码
const generator = new NodeCodeGenerator(schema, values, serverRoot);
const code = generator.generate();

// 更新 Cell
const updater = new CellUpdater(notebook, serverRoot);
updater.updateCellForNode(nodeId);
```

## 优势

1. **职责清晰** - 每个类只负责一件事
2. **易于测试** - 可以单独测试每个模块
3. **易于扩展** - 添加新功能不影响现有代码
4. **类型安全** - 充分利用 TypeScript 类型系统
