import * as types from '@babel/types'

import preset from 'jss-preset-default'
import jss from 'jss'
jss.setup(preset())

import { cammelCaseToDashCase, stringToCamelCase } from '../../../utils/helpers'
import { addJSXTagStyles, addExternalPropOnJsxOpeningTag } from '../../../utils/jsx-ast'
import { ParsedASTNode } from '../../../utils/js-ast'

export const splitDynamicAndStaticProps = (style: Record<string, any>) => {
  return Object.keys(style).reduce(
    (
      acc: { staticStyles: Record<string, any>; dynamicStyles: Record<string, any> },
      key
    ) => {
      const value = style[key]
      if (typeof value === 'string' && value.startsWith('$props.')) {
        acc.dynamicStyles[key] = value.replace('$props.', '')
      } else {
        acc.staticStyles[key] = value
      }
      return acc
    },
    { staticStyles: {}, dynamicStyles: {} }
  )
}

export const prepareDynamicProps = (style: any, t = types) => {
  return Object.keys(style).reduce((acc: any, key) => {
    const value = style[key]
    acc[key] = new ParsedASTNode(
      t.memberExpression(
        t.identifier('props'),
        t.identifier(value.replace('$props.', ''))
      )
    )
    return acc
  }, {})
}

interface ApplyCSSModulesAndGetDeclarationsParams {
  nodesLookup: any
  camelCaseClassNames: boolean
}

export const applyCSSModulesAndGetDeclarations = (
  content: any,
  params: ApplyCSSModulesAndGetDeclarationsParams,
  t = types
) => {
  let accumulator: any[] = []
  const { nodesLookup = {}, camelCaseClassNames } = params

  // only do stuff if content is a object
  if (content && typeof content === 'object') {
    const { style, children, name } = content
    if (style) {
      const root = nodesLookup[name]
      const className = cammelCaseToDashCase(name)
      const classNameInJS = camelCaseClassNames ? stringToCamelCase(className) : className
      const { staticStyles, dynamicStyles } = splitDynamicAndStaticProps(style)

      // TODO Should we build a different plugin for dynamic props as inline styles?
      const inlineStyle = prepareDynamicProps(dynamicStyles)
      if (Object.keys(inlineStyle).length) {
        addJSXTagStyles(root, inlineStyle)
      }

      accumulator.push(
        jss
          .createStyleSheet(
            {
              [`.${className}`]: staticStyles,
            },
            {
              generateClassName: () => className,
            }
          )
          .toString()
      )

      const cssClassNameFromStylesObject = camelCaseClassNames
        ? `styles.${classNameInJS}`
        : `styles['${className}']`

      addExternalPropOnJsxOpeningTag(
        root,
        'className',
        t.identifier(cssClassNameFromStylesObject)
      )
    }

    if (children && Array.isArray(children)) {
      children.forEach((child) => {
        const items = applyCSSModulesAndGetDeclarations(child, params)
        accumulator = accumulator.concat(...items)
      })
    }
  }

  return accumulator
}
