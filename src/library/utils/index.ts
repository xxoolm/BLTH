import _ from 'lodash'
import CryptoJS from 'crypto-js'
import type { RunAtMoment } from '@/types'
import { ts } from '@/library/luxon'

/**
 * 生成一个 version 4 uuid
 * @returns uuid
 */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
    const randomInt = (16 * Math.random()) | 0
    return ('x' === char ? randomInt : (3 & randomInt) | 8).toString(16)
  })
}

/**
 * 基于 Promise 的睡眠函数
 * @param miliseconds 睡眠时间
 */
function sleep(miliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, miliseconds))
}

/**
 * 对请求参数进行 wbi 签名
 * @param params 请求参数
 * @param imgKey img_key
 * @param subKey sub_key
 */
function wbiSign(
  params: Record<string, string | number | object>,
  imgKey: string,
  subKey: string
): string {
  // 拼接 imgKey 和 subKey
  const imgAndSubKey = imgKey + subKey
  // 将 imgKey 和 subKey 中的字符按特定顺序重新排列，取前32位
  const salt = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
    28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
    54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
  ]
    .map((n) => imgAndSubKey[n])
    .join('')
    .slice(0, 32)
  // 添加 wts 字段（当前秒级时间戳）
  params.wts = ts()
  // 按照键对参数进行排序
  const query = Object.keys(params)
    .sort()
    .map((key) => {
      // 过滤 value 中的 !'()* 字符
      const value = params[key].toString().replace(/[!'()*]/g, '')
      // 注：空格需被编码为%20而不是+，因此不能使用URLSearchParams
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')
  // 计算 w_rid
  const wbiSign = CryptoJS.MD5(query + salt).toString()

  return query + '&w_rid=' + wbiSign
}

/**
 * 把一个普通对象打包为 FormData
 * @param json 一个不包含嵌套对象的对象
 * @returns FormData
 */
function packFormData(json: Record<string, any>): FormData {
  const formData = new FormData()
  _.forEach(json, (value, key) => formData.append(key, value.toString()))
  return formData
}

/**
 * 遍历一个对象最深层的属性
 * @param obj 要遍历的对象
 * @param fn 回调函数，参数是最深层属性的值和当前路径
 * @param path 遍历对象的路径，默认从最外层开始遍历
 */
function deepestIterate(obj: any, fn: (value: any, path: string) => void, path?: string) {
  _.forOwn(obj, function (value, key) {
    const newPath = path ? path + '.' + key : key
    if (_.isPlainObject(value) && !_.isEmpty(value)) {
      deepestIterate(value, fn, newPath)
    } else {
      fn(value, newPath)
    }
  })
}

/**
 * 从 fetch 的 input 参数中获取 URL
 * @param input fetch 的第一个参数
 * @returns URL
 */
function getUrlFromFetchInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  } else if (input instanceof URL) {
    return input.toString()
  } else if (input instanceof Request) {
    return input.url
  } else {
    return 'Incorrect input'
  }
}

/**
 * 等待直到指定时刻
 * @param moment 运行时机
 */
function waitForMoment(moment: RunAtMoment): Promise<void> {
  switch (moment) {
    case 'document-start': {
      // 在 document-start 阶段，document-head 可能为 null
      return Promise.resolve()
    }
    case 'document-head': {
      // 在 document-head 阶段，document.head 已经出现但是部分内部节点可能还没出现
      return new Promise((resolve) => {
        if (document.head) {
          resolve()
        } else {
          const observer = new MutationObserver(() => {
            if (document.head) {
              observer.disconnect()
              resolve()
            }
          })
          observer.observe(document.documentElement, { childList: true })
        }
      })
    }
    case 'document-body': {
      // 在 document-body 阶段，document.body 已经出现但是部分内部节点可能还没出现
      return new Promise((resolve) => {
        if (document.body) {
          resolve()
        } else {
          const observer = new MutationObserver(() => {
            if (document.body) {
              observer.disconnect()
              resolve()
            }
          })
          observer.observe(document.documentElement, { childList: true })
        }
      })
    }
    case 'document-end': {
      // 在 document-end 阶段，DOM 加载完成，但部分资源可能还没获取到（比如图片）
      return new Promise((resolve) => {
        if (document.readyState !== 'loading') {
          resolve()
        } else {
          document.addEventListener('DOMContentLoaded', () => resolve())
        }
      })
    }
    case 'window-load': {
      // 在 window-load 阶段，整个网页加载完毕
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve()
        } else {
          window.addEventListener('load', () => resolve())
        }
      })
    }
    default: {
      return Promise.reject('Illegal moment')
    }
  }
}

export { uuid, sleep, wbiSign, packFormData, deepestIterate, getUrlFromFetchInput, waitForMoment }
