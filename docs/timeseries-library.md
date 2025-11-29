# 时序数据分析算法库与提示词库扩展文档

本文档详细描述了当前后端 (`aiserver`) 已实现的算法库结构、内容及后续扩展计划。文档旨在规范算法开发流程，确保提示词（Prompts）与代码模板（Templates）的一致性与专业性。

## 1. 架构概览

后端算法库主要由三个核心组件构成：

1.  **算法提示词定义 (`ALGORITHM_PROMPTS`)**: 位于 `aiserver/algorithm_prompts.py`。定义了算法的分类、ID、显示名称及对应的自然语言提示词模板。
2.  **算法代码模板 (`ALGORITHM_TEMPLATES`)**: 位于 `aiserver/algorithm_templates.py`。定义了每个算法 ID 对应的 Python 可执行代码模板。模板中包含 `{VAR_NAME}` 等占位符，用于动态替换变量名。
3.  **算法描述 (`ALGORITHM_DESCRIPTIONS`)**: 位于 `aiserver/algorithm_templates.py`。提供算法的简短技术说明，用于前端展示或元数据说明。

### 1.1 核心规范

*   **变量占位符**: 所有模板统一使用 `{VAR_NAME}` 作为输入 DataFrame/Series 的变量名占位符。
*   **输入格式**: 默认假设 `{VAR_NAME}` 为 pandas DataFrame 或 Series，且索引（Index）通常为时间序列（DatetimeIndex）。
*   **代码风格**: 
    *   使用标准的 Python 数据科学栈 (`pandas`, `numpy`, `matplotlib`, `seaborn`, `scipy`, `statsmodels`, `sklearn`)。
    *   包含必要的 import 语句（即使可能重复，为保证单元格独立运行）。
    *   包含中文注释，解释关键参数与步骤。
    *   可视化代码需处理中文显示 (`SimHei`) 和负号显示问题。
    *   可视化图表需包含 `plt.show()` 或 `display()`。

---

## 2. 现有算法库清单 (Current Library)

当前库包含四大类：数据预处理、探索式分析 (EDA)、异常检测、趋势绘制。

### 2.1 数据预处理 (data_preprocessing)

| ID | 名称 | 功能描述 | 关键技术点 |
| :--- | :--- | :--- | :--- |
| `smoothing_sg` | Savitzky-Golay 平滑 | 去除高频噪声并保留波形特征 | `scipy.signal.savgol_filter`, 插值预处理 |
| `smoothing_ma` | 移动平均平滑 | 简单平滑去噪 | `rolling().mean()`, 居中窗口 |
| `interpolation_time` | 时间加权插值 | 基于时间间隔填补缺失值 | `interpolate(method='time')`, 物理意义准确 |
| `interpolation_spline` | 样条插值 | 平滑曲线补全 | `interpolate(method='spline', order=3)` |
| `resampling_down` | 降采样 (聚合) | 降低时间分辨率 | `resample()`, 数值取均值/非数值取首值 |
| `alignment` | 多源数据对齐 | 基于时间戳对齐不同数据源 | `merge_asof`, 需指定 `direction='nearest'` |

### 2.2 探索式分析 (eda)

| ID | 名称 | 功能描述 | 关键技术点 |
| :--- | :--- | :--- | :--- |
| `summary_stats` | 时序统计摘要 | 基础统计、分布、缺失、时间范围 | `describe()`, `skew()`, `kurt()`, 频率推断 |
| `line_plot` | 多尺度时序曲线 | 绘制时序图，支持大数据量 | 自动下采样 (>10k点), `matplotlib` |
| `spectral_analysis` | 频谱分析 (PSD) | 识别数据的周期性成分 | `scipy.signal.welch`, 半对数坐标 |
| `autocorrelation` | 自相关分析 (ACF) | 识别自相关性与滞后效应 | `statsmodels.plot_acf` |
| `decomposition` | STL 分解 | 分解趋势、季节与残差 | `statsmodels.tsa.seasonal.STL`, 鲁棒性强 |
| `heatmap_distribution` | 时序热力图 | 观察日内或季节性分布模式 | `pivot_table` (Date vs Hour), `seaborn.heatmap` |

### 2.3 异常检测 (anomaly_detection)

| ID | 名称 | 功能描述 | 关键技术点 |
| :--- | :--- | :--- | :--- |
| `threshold_sigma` | 3-Sigma 阈值检测 | 基于统计分布检测离群点 | 滚动均值/标准差, `mean ± 3*std` |
| `isolation_forest` | 孤立森林检测 | 无监督多维异常检测 | `sklearn.ensemble.IsolationForest` |
| `change_point` | 变点检测 | 检测统计特性突变的时间点 | `ruptures.Binseg` (L2 loss) |

### 2.4 趋势绘制 (trend_plot)

| ID | 名称 | 功能描述 | 关键技术点 |
| :--- | :--- | :--- | :--- |
| `trend_ma` | 移动平均趋势 | 基础趋势提取 | `rolling(window=...).mean()` |
| `trend_ewma` | 指数加权趋势 | 近期权重更高的趋势 | `ewm(span=...).mean()` |
| `trend_loess` | LOESS 趋势 | 局部加权回归平滑 | `statsmodels...lowess`, 非参数平滑 |
| `trend_polyfit` | 多项式趋势拟合 | 全局多项式拟合 | `numpy.polyfit` (deg=2) |
| `trend_stl_trend` | STL 趋势分量 | 基于 STL 分解提取趋势 | `STL(...).trend` |
| `trend_basic_stacked` | 基础趋势 (分栏) | 多变量垂直分栏展示 | `subplots`, 共享 X 轴 |
| `trend_basic_overlay` | 基础趋势 (叠加) | 多变量同一坐标轴展示 | 颜色区分, 适合量级相近数据 |
| `trend_basic_grid` | 基础趋势 (网格) | 多变量网格状展示 | 自动计算 `n_rows`, `n_cols` |

---

## 3. 扩展规划 (Extension Plan)

为满足更复杂的分析需求，计划在现有分类下新增以下算法，并新增“预测分析”分类。

### 3.1 新增：预测分析 (forecasting)

| ID | 名称 | 拟定 Prompt 模板 | 实现思路 |
| :--- | :--- | :--- | :--- |
| `forecast_arima` | ARIMA 预测 | "请对 {VAR_NAME} 使用 ARIMA 模型进行未来 7 天的预测。自动评估参数 (p,d,q)，并绘制包含置信区间的预测结果。" | 使用 `pmdarima.auto_arima` 或 `statsmodels`，需处理非平稳性。 |
| `forecast_prophet` | Prophet 预测 | "请对 {VAR_NAME} 使用 Prophet 模型进行趋势预测。考虑节假日效应（如适用），并分解展示趋势和季节成分。" | 使用 `prophet` 库，需将 DataFrame 转换为 `ds`, `y` 格式。 |
| `forecast_holtwinters` | Holt-Winters 指数平滑 | "请对 {VAR_NAME} 使用三次指数平滑 (Holt-Winters) 进行预测。包含加法/乘法季节性模型，并绘制拟合曲线。" | `statsmodels.tsa.holtwinters.ExponentialSmoothing`。 |

### 3.2 扩展：探索式分析 (eda)

| ID | 名称 | 拟定 Prompt 模板 | 实现思路 |
| :--- | :--- | :--- | :--- |
| `stationarity_test` | 平稳性检验 (ADF) | "请对 {VAR_NAME} 进行平稳性检验。使用 ADF (Augmented Dickey-Fuller) 测试，输出 t 统计量和 p 值，并判断数据是否平稳。" | `statsmodels.tsa.stattools.adfuller`。 |
| `lag_plot` | 滞后图分析 | "请对 {VAR_NAME} 绘制滞后图 (Lag Plot)。展示 lag=1 到 lag=4 的关系，用于观察数据的随机性或自相关性。" | `pandas.plotting.lag_plot`。 |
| `correlation_matrix` | 多变量相关性矩阵 | "请计算 {VAR_NAME} 中各数值变量间的相关系数矩阵，并绘制热力图展示相关性强弱。" | `df.corr()`, `seaborn.heatmap`。 |

### 3.3 扩展：数据预处理 (data_preprocessing)

| ID | 名称 | 拟定 Prompt 模板 | 实现思路 |
| :--- | :--- | :--- | :--- |
| `feature_scaling` | 数据标准化/归一化 | "请对 {VAR_NAME} 进行特征缩放。提供 Z-Score 标准化和 Min-Max 归一化两种结果，便于后续模型训练。" | `sklearn.preprocessing.StandardScaler/MinMaxScaler`。 |
| `diff_transform` | 差分变换 | "请对 {VAR_NAME} 进行一阶和二阶差分处理，以消除趋势并使数据平稳，绘制差分后的时序图。" | `df.diff()`, `dropna()`。 |
| `outlier_clip` | 离群值盖帽 (Winsorization) | "请对 {VAR_NAME} 进行离群值盖帽处理。将超出 1% 和 99% 分位数的值限制在边界范围内，以减少极端值的影响。" | `df.clip(lower=p01, upper=p99)`。 |
| `feature_extraction_time` | 时间特征提取 | "请从 {VAR_NAME} 的时间索引中提取特征。生成‘小时’、‘星期几’、‘月份’、‘是否周末’等新列，用于机器学习模型输入。" | `dt.hour`, `dt.dayofweek`, `dt.month`。 |
| `feature_lag` | 滞后特征生成 | "请对 {VAR_NAME} 生成滞后特征。创建滞后 1 至 3 个时间步的列（lag_1, lag_2, lag_3），用于自回归分析。" | `df.shift(i)`。 |
| `transform_log` | 对数变换 | "请对 {VAR_NAME} 进行对数变换。使用 log1p 处理以稳定方差，并绘制变换前后的分布对比图。" | `np.log1p()`, 处理负值需谨慎。 |
| `filter_butterworth` | 巴特沃斯低通滤波 | "请对 {VAR_NAME} 应用巴特沃斯低通滤波器。设置截止频率和阶数，去除高频噪声，保留主要趋势信号。" | `scipy.signal.butter`, `filtfilt`。 |

---

## 4. 开发指南

### 4.1 添加新算法步骤

1.  **定义 Prompt**: 在 `aiserver/algorithm_prompts.py` 中找到对应分类（或新建分类），添加新的字典项。
    *   `id`: 唯一标识符 (Snake Case, 如 `my_new_algo`)。
    *   `name`: 中文显示名称。
    *   `prompt`: 详细的自然语言指令，必须包含 `{VAR_NAME}`。

2.  **编写 Template**: 在 `aiserver/algorithm_templates.py` 的 `ALGORITHM_TEMPLATES` 字典中添加对应 `id` 的 Key。
    *   Value 为多行字符串（Python 代码）。
    *   代码应自包含（Imports included）。
    *   **关键**: 所有的变量名引用必须使用 `{VAR_NAME}`。
    *   **错误处理**: 推荐在关键步骤添加 `try-except` 块。

3.  **添加描述**: 在 `aiserver/algorithm_templates.py` 的 `ALGORITHM_DESCRIPTIONS` 中添加简短说明。

### 4.2 模板代码最佳实践示例

```python
    "my_new_algo": """
import pandas as pd
import matplotlib.pyplot as plt

# 1. 复制数据，避免修改原件
df_proc = {VAR_NAME}.copy()

# 2. 核心逻辑 (示例：计算滚动最大值)
try:
    # 确保处理的是数值列
    numeric_cols = df_proc.select_dtypes(include=['number']).columns
    for col in numeric_cols:
        df_proc[f'{col}_max'] = df_proc[col].rolling(10).max()
        
    # 3. 可视化或结果展示
    df_proc.tail().plot()
    plt.title("Rolling Max Analysis")
    plt.show()
    
except Exception as e:
    print(f"算法执行失败: {e}")
"""
```

## 5. 依赖管理

新增算法可能引入新的 Python 库依赖。当前已包含：
*   pandas
*   numpy
*   scipy
*   matplotlib
*   seaborn
*   statsmodels
*   sklearn
*   ruptures

**计划引入依赖**:
*   `pmdarima` (用于 Auto-ARIMA)
*   `prophet` (用于 Prophet 预测) - *注意：Prophet 安装较为复杂，需评估环境兼容性*。

---
*文档最后更新时间: 2025-11-29*
