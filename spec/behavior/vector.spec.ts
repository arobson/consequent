import { describe, it, expect } from 'vitest'
import * as vector from '../../src/vector.js'

describe('Vector', function () {
  describe('when parsing vectors', function () {
    it('should parse empty vector correcty', function () {
      expect(vector.parse('')).toEqual({})
    })

    it('should parse partially empty vector correcty', function () {
      expect(vector.parse(';a:1')).toEqual({ a: 1 })
    })

    it('should parse vectors correctly', function () {
      expect(vector.parse('a:2;b:1')).toEqual({ a: 2, b: 1 })
      expect(vector.parse('c:3;a:2;b:1')).toEqual({ a: 2, b: 1, c: 3 })
    })
  })

  describe('when stringifying', function () {
    it('should stringify empty vectors correctly', function () {
      expect(vector.stringify({})).toEqual('')
    })

    it('should stringify vecotrs', function () {
      expect(vector.stringify({ a: 1 })).toEqual('a:1')
      expect(vector.stringify({ a: 1, b: 2 })).toEqual('a:1;b:2')
      expect(vector.stringify({ c: 3, a: 1, b: 2 })).toEqual('a:1;b:2;c:3')
    })
  })

  describe('when incrementing', function () {
    it('should increment empty vector correctly', function () {
      const v = {}
      vector.increment(v, 'a')
      expect(v).toEqual({ a: 1 })
    })

    it('should increment vector correctly', function () {
      const v: Record<string, number> = { a: 1 }
      vector.increment(v, 'a')
      expect(v).toEqual({ a: 2 })
      vector.increment(v, 'b')
      expect(v).toEqual({ a: 2, b: 1 })
      vector.increment(v, 'c')
      vector.increment(v, 'c')
      vector.increment(v, 'c')
      expect(v).toEqual({ a: 2, b: 1, c: 3 })
    })
  })

  describe('when getting version', function () {
    it('should get empty vector version correctly', function () {
      expect(vector.toVersion('')).toEqual(0)
    })

    it('should parse vector correctly', function () {
      expect(vector.toVersion('a:1')).toEqual(1)
      expect(vector.toVersion('a:1;b:4')).toEqual(5)
      expect(vector.toVersion('a:1;b:4;c:7')).toEqual(12)
    })
  })
})
