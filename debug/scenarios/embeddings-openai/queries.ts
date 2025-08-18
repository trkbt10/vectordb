/**
 * @file Query seeds for OpenAI embeddings debug scenario.
 */

import type { FilterExpr } from '../../../src/filter/expr'

export type QueryDef = { q: string; desc: string; expr?: FilterExpr }

export const QUERIES: QueryDef[] = [
  { q: '生成AIの実務活用と埋め込み検索', desc: '近傍(制約なし)' },
  { q: '手早く作れるパスタレシピ', desc: '近傍(制約なし)' },
  { q: '最新のベクトル検索の実装', desc: 'year>=2023', expr: { must: [{ key: 'year', range: { gte: 2023 } }] } },
  { q: 'フォークランド紛争の話', desc: 'tags contains uk/war/ww1/royal (OR)', expr: { should: [{ key: 'tags', match: 'uk' }, { key: 'tags', match: 'war' }, { key: 'tags', match: 'ww1' }, { key: 'tags', match: 'royal' }], should_min: 1 } },
  { q: 'ペンギンの話', desc: 'tags contains antarctica/arctic/animal (OR)', expr: { should: [{ key: 'tags', match: 'antarctica' }, { key: 'tags', match: 'arctic' }, { key: 'category', match: 'animal' }], should_min: 1 } },
  { q: 'アルゼンチンの話', desc: 'tags contains peru/amazon/inca (OR)', expr: { should: [{ key: 'tags', match: 'peru' }, { key: 'tags', match: 'amazon' }, { key: 'tags', match: 'inca' }], should_min: 1 } },
  { q: 'イギリスの話', desc: 'tags contains uk', expr: { must: [{ key: 'tags', match: 'uk' }] } },
]
/**
 * @file Query seeds for OpenAI embeddings debug scenario.
 */
