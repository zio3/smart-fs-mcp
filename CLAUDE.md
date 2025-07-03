# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Smart Filesystem MCPは、LLMに最適化されたファイルシステム操作を提供する**シンプルファースト**なModel Context Protocol (MCP)サーバーです。主要な設計原則は、必要な操作数を最小限に抑えることで、ほとんどのタスクは単一の`read_file`コマンドで完了します。

## 主要な設計哲学: シンプルファースト

1. **基本操作は通常通り動作**: `read_file`は安全な場合、コンテンツを直接返します
2. **スマートなエラーハンドリング**: 制限を超えた場合のみ詳細情報を提供
3. **ワンステップワークフロー**: プレビュー/分析/読み取りのチェーンは不要
4. **段階的な情報開示**: 必要な場合のみ詳細情報と代替案を提供
5. **ステートレス設計**: すべてのpathパラメータは絶対パス必須

### ステートレス設計原則

**絶対パス必須** - すべてのファイル・ディレクトリ操作は絶対パスを要求します:
- 相対パス（`./file.txt`, `../parent/`）は受け付けません
- 起動ディレクトリ（`process.cwd()`）への依存を排除
- 各リクエストが完全に自己記述的で予測可能
- LLM利用において外部状態への依存を回避

## 主要な開発コマンド

```bash
# 依存関係のインストール
npm install

# TypeScriptプロジェクトのビルド
npm run build

# 開発モードで実行
npm run dev

# 型チェックの実行
npm run typecheck

# リントの実行
npm run lint

# すべてのテストを実行
npm test

# 特定のテストスイートを実行
npm run test:tools    # ツールのみテスト
npm run test:core     # コアモジュールのみテスト
npm run test:api      # APIエンドポイントのみテスト
npm run test:unit     # 統合テストをスキップ

# カバレッジ付きでテストを実行
npm run test:coverage

# ウォッチモードでテストを実行
npm run test:watch

# 単一のテストファイルを実行
npm test src/tools/read-file.test.ts

# CLIテストコマンド
npm run cli list <directory>    # ディレクトリリストのテスト
npm run cli read <file>         # ファイル読み取りのテスト
npm run cli search [directory]  # 検索機能のテスト

# APIサーバーコマンド
npm run api:dev    # 開発モードでAPIサーバーを実行
npm run api:build  # プロダクション用にビルド
npm run api:start  # プロダクションサーバーを起動
```

## アーキテクチャ概要

### 三層アーキテクチャ設計

```
MCP Server Layer (src/index.ts)
├── Tool Layer (src/tools/*.ts) - 各ツールの実装
├── Core Layer (src/core/*.ts) - 共通機能とビジネスロジック  
└── Utils Layer (src/utils/*.ts) - 統一エラーハンドリングと共通ユーティリティ
```

### コアコンポーネント

1. **UnifiedErrorHandler** (`src/utils/unified-error-handler.ts`) - 🆕 重要
   - **全ツール統一のエラーハンドリング**
   - セキュアなエラーサニタイゼーション
   - 日本語エラーメッセージの提供
   - MCP例外撲滅の中核

2. **SafetyController** (`src/core/safety-controller.ts`)
   - 実行前に操作を検証
   - サイズとタイムアウトの制限を強制
   - 主要メソッド: `validateFileAccess()`, `enforceTimeout()`, `validateDirectoryAccess()`

3. **SecurityControllerV2** (`src/core/security-controller-v2.ts`)
   - 許可ディレクトリの管理
   - パストラバーサル攻撃の防止
   - クロスプラットフォーム対応のセキュリティ検証

4. **FileAnalyzer** (`src/core/file-analyzer.ts`)
   - ファイルのタイプ、エンコーディング、トークン数を分析
   - 主にエラーレスポンスで使用
   - 主要メソッド: `analyzeFile()`, `detectFileType()`

5. **SearchEngine** (`src/core/search-engine.ts`)
   - ファイルとコンテンツの検索操作を処理
   - 安全性制御付きの正規表現ベースのパターンマッチング
   - 主要メソッド: `searchByFilePattern()`, `searchByContent()`

### MCPサーバー設計（重要な変更）

**MCPサーバーはパススルー設計** - `src/index.ts`
- パラメータバリデーションを**除去**
- ツール関数に直接委譲
- 統一エラー形式をそのまま返却
- MCP例外を投げない設計

### ツール実装パターン

全ツールが以下のパターンに従います:

```typescript
// 統一パターン
export async function toolName(params: Params, safety: SafetyController): Promise<Success | UnifiedError> {
  // 1. 入力バリデーション（統一エラー形式で返却）
  // 2. セキュリティチェック
  // 3. 操作実行
  // 4. 例外処理（統一エラー形式に変換）
}
```

### ツール使用パターン

#### read_file - プライマリツール

```typescript
// 成功ケース - コンテンツを直接返す
{
  "tool": "read_file",
  "arguments": { "path": "./small-file.txt" }
}
// レスポンス: { "status": "success", "content": "ファイルの内容..." }

// 制限超過 - 詳細情報を返す
{
  "tool": "read_file", 
  "arguments": { "path": "./large-file.log" }
}
// レスポンス: {
//   "status": "size_exceeded",
//   "file_info": { size, tokens, type },
//   "preview": { first_lines, content_summary },
//   "alternatives": { force_read_available, suggestions }
// }
```

#### force_read_file - 必要な場合

```typescript
// size_exceededを確認後、必要に応じて強制読み取り
{
  "tool": "force_read_file",
  "arguments": { 
    "path": "./large-file.log",
    "acknowledge_risk": true
  }
}
```

#### search_content - 強力な検索

```typescript
// 名前でファイルを検索
{
  "tool": "search_content",
  "arguments": { 
    "file_pattern": ".*\\.test\\.ts$",
    "directory": "/absolute/path/to/src"
  }
}

// 正規表現でコンテンツを検索
{
  "tool": "search_content",
  "arguments": {
    "content_pattern": "TODO|FIXME|HACK",
    "directory": "/absolute/path/to/project",
    "extensions": [".js", ".ts"]
  }
}

// 複合検索
{
  "tool": "search_content",
  "arguments": {
    "file_pattern": "config",
    "content_pattern": "database.*url",
    "directory": "/absolute/path/to/project",
    "case_sensitive": true
  }
}
```

### 主要な安全制限

- デフォルトファイルサイズ: 20kb (超過した場合はプレビューを返す)
- 強制読み取り最大: 256kb
- 検索タイムアウト: 30秒
- 最大検索結果: 500ファイル
- 正規表現パターン長: 1000文字
- ディレクトリスキャンのデフォルト: 1000ファイル
- トークン警告: 50,000トークン
- 操作タイムアウト: 5-30秒

## 主要な型定義

### コアタイプ (`src/core/types.ts`)

- `FileInfo`: サイズとタイムスタンプを含む基本的なファイル情報
- `FileAnalysis`: タイプ検出を含む拡張分析
- `OperationResult<T>`: status: 'success' | 'error' | 'warning' を持つ標準結果ラッパー
- `SafetyValidation`: 安全性チェックの結果
- 各MCPツール用のツール固有のパラメータとレスポンスタイプ

### 重要な型の変更

- `OperationResult`は`success`ブール値ではなく`status`プロパティを使用
- ファイルリストは`size`と`timestamps.modified`を持つ`FileInfo`を使用
- 検索結果にはISO文字列として`file_size_bytes`と`last_modified`が含まれる

## 重要な開発ガイドライン

### 統一エラーハンドリング（必須）

**全てのツールが統一エラー形式を使用します** - `src/utils/unified-error-handler.ts`

```typescript
// ✅ 正しい統一エラー形式
{
  "success": false,
  "error": {
    "code": "missing_path",
    "message": "ファイルパスが指定されていません",
    "details": {
      "operation": "read_file",
      "path": "/invalid/path"
    },
    "suggestions": [
      "有効なファイルパスを指定してください"
    ]
  }
}
```

**重要な実装規則:**
1. **MCP例外を投げない** - 全てのエラーは統一形式で返却
2. **空パス検証** - 全ツールで`validatePath()`使用必須
3. **セキュリティ重視** - `createUnifiedError()`がデータをサニタイズ
4. **日本語メッセージ** - 全エラーメッセージは日本語で提供

### エラーハンドリングパターン

```typescript
// 推奨パターン
import { createUnifiedError, ErrorCodes, validatePath } from '../utils/unified-error-handler.js';

export async function myTool(params: MyParams): Promise<MySuccess | UnifiedError> {
  // 1. パスバリデーション
  const pathValidation = validatePath(params.path);
  if (!pathValidation.valid) {
    return createUnifiedError(
      ErrorCodes.MISSING_PATH,
      'my_tool',
      {},
      pathValidation.error?.includes('empty') ? 'パスが指定されていません' : '不正なパス形式です'
    );
  }
  
  // 2. 絶対パスチェック
  if (!path.isAbsolute(params.path)) {
    return createUnifiedError(
      ErrorCodes.PATH_NOT_ABSOLUTE,
      'my_tool',
      { path: params.path }
    );
  }
  
  try {
    // 操作を実行
    return { success: true, result: data };
  } catch (error) {
    // 3. 例外を統一エラーに変換
    return createUnifiedErrorFromException(error, 'my_tool', params.path);
  }
}
```

### 新機能の追加

1. **シンプルファースト哲学を維持**
2. **統一エラーハンドリング必須**
3. **デフォルトで結果を直接返す**
4. **制限に達した場合のみ複雑さを追加**
5. **絶対パス必須の維持**

### テストアプローチ

```bash
# 成功する読み取りのテスト
npm run cli read package.json

# 大きなファイルの処理のテスト
npm run cli read large-file.log

# ディレクトリリストのテスト（絶対パス必須）
npm run cli list /absolute/path/to/src --hidden --sort size

# 検索機能のテスト（絶対パス必須）
npm run cli search -c "TODO" /absolute/path/to/src

# 空パスのエラーテスト（統一エラー形式確認）
npm run cli read ""

# 統一エラーハンドリングのテスト
npm test -- --testNamePattern="unified"
```

## 一般的なワークフロー

### ファイルの読み取り

1. 常に最初に`read_file`を試す
2. サイズ超過の場合、レスポンスのプレビューを確認
3. 完全なコンテンツが必要な場合のみ`force_read_file`を使用

### コードの検索（絶対パス必須）

1. 特定のコードを見つけるために`search_content`をコンテンツパターンと共に使用
2. **必ず絶対パスを指定** - 相対パスは拒否される
3. 正確な検索のためにファイルパターンとコンテンツパターンを組み合わせる
4. 正規表現フラグを適切に使用（大文字小文字の区別、単語全体）

### ファイルの編集 - スマート編集アプローチ

**デフォルト戦略: シンプルから始める**

```typescript
// ✅ 推奨: シンプルな文字列置換（絶対パス必須）
{
  "tool": "edit_file",
  "arguments": {
    "path": "/absolute/path/to/config.js",
    "edits": [
      {"oldText": "const PORT = 3000", "newText": "const PORT = 8080"}
    ]
  }
}

// 🎯 必要な場合: パターン用の正規表現（絶対パス必須）
{
  "tool": "edit_file", 
  "arguments": {
    "path": "/absolute/path/to/utils.js",
    "edits": [
      {
        "type": "regex",
        "pattern": "function\\s+temp\\d+",
        "replacement": "function temp",
        "flags": "g"
      }
    ]
  }
}
```

**決定マトリックス:**

| シナリオ | 方法 | 例 |
|----------|--------|---------|
| 設定値の変更 | シンプル | `"PORT = 3000"` → `"PORT = 8080"` |
| インポートパスの更新 | シンプル | `"./old-path"` → `"./new-path"` |
| 複数の番号付き変数 | 正規表現 | `user1, user2, user3` → `user` |
| 空白のクリーンアップ | 正規表現 | 複数スペース → 単一スペース |
| コメントスタイルの変更 | 正規表現 | `//` → `/* */` |

**以下の場合は常にdry_runを使用:**
- 正規表現操作
- 複数の同時編集
- 100行を超えるファイル

**ワークフロー:**
1. シンプルな置換から始める（90%のケースで十分）
2. パターンがある場合のみ正規表現を検討
3. 適用前に`dry_run: true`でプレビュー
4. diff出力とマッチ数を確認
5. 満足したらdry_runなしで編集を適用

### バイナリファイルの処理

- `read_file`はバイナリファイルを検出して報告
- エラーレスポンスでファイルタイプ情報を提供
- ファイルタイプに適したツールを提案

## APIサーバーモード

プロジェクトにはブラウザ/CURLテスト用のExpressベースのREST APIサーバーが含まれています:

```bash
# APIサーバーを起動
npm run api:dev

# SwaggerUIドキュメントにアクセス
http://localhost:3000/api-docs

# APIエンドポイントはRESTfulパターンに従います:
GET    /api/files/content?path=...
POST   /api/files/content
PUT    /api/files/edit
DELETE /api/files?path=...
GET    /api/directories/list?path=...
POST   /api/search/content
```

## 重要な注意事項・制限

### プロジェクト技術仕様
- **ESモジュール必須** - `"type": "module"`を使用
- **`.js`拡張子必須** - すべてのインポートに`.js`拡張子を含める
- **絶対パス必須** - 全ての操作で絶対パスを要求（ステートレス設計）
- **TypeScript** - 型安全性とコンパイル時エラー検出

### 統一エラーハンドリング制限
- **MCP例外禁止** - 全ツールで統一エラー形式を使用
- **日本語必須** - エラーメッセージは日本語で提供
- **セキュリティ重視** - 機密情報の漏洩を防止

### 運用制限
- **シンプルファースト** - 複雑なワークフローは推奨されません
- **許可ディレクトリ制限** - セキュリティモデルが強制
- **クロスプラットフォーム** - Windows/Unix両対応