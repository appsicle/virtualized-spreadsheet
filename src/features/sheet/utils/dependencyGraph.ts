import type { Graph } from '../types'

export function newGraph(): Graph {
  return { depsOf: new Map(), dependentsOf: new Map() }
}

export function setDeps(g: Graph, a: string, deps: Set<string>) {
  const old = g.depsOf.get(a) ?? new Set<string>()
  for (const d of old) {
    const rev = g.dependentsOf.get(d)
    if (rev) {
      rev.delete(a)
      if (rev.size === 0) g.dependentsOf.delete(d)
    }
  }
  g.depsOf.set(a, new Set(deps))
  for (const d of deps) {
    if (!g.dependentsOf.has(d)) g.dependentsOf.set(d, new Set())
    g.dependentsOf.get(d)!.add(a)
  }
}

export function removeNode(g: Graph, a: string) {
  const deps = g.depsOf.get(a)
  if (deps) {
    for (const d of deps) g.dependentsOf.get(d)?.delete(a)
    g.depsOf.delete(a)
  }
  const rev = g.dependentsOf.get(a)
  if (rev) {
    for (const r of rev) g.depsOf.get(r)?.delete(a)
    g.dependentsOf.delete(a)
  }
}

export function affectedAfterChange(g: Graph, start: string): Set<string> {
  const out = new Set<string>()
  const q = [start]
  while (q.length) {
    const x = q.shift()!
    if (out.has(x)) continue
    out.add(x)
    for (const dep of g.dependentsOf.get(x) ?? []) q.push(dep)
  }
  return out
}

export function topoOrder(g: Graph, nodes: Set<string>): { order: string[]; cyclic: Set<string> } {
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    let deg = 0
    for (const d of g.depsOf.get(n) ?? []) if (nodes.has(d)) deg++
    inDeg.set(n, deg)
  }
  const q: string[] = []
  for (const [n, deg] of inDeg) if (deg === 0) q.push(n)
  const order: string[] = []
  while (q.length) {
    const n = q.shift()!
    order.push(n)
    for (const dep of g.dependentsOf.get(n) ?? []) {
      if (!nodes.has(dep)) continue
      const d = inDeg.get(dep)!
      inDeg.set(dep, d - 1)
      if (d - 1 === 0) q.push(dep)
    }
  }
  const cyclic = new Set<string>()
  for (const [n, deg] of inDeg) if (deg > 0) cyclic.add(n)
  return { order, cyclic }
}
