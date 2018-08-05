/**
 * 1. resolve modules
 * 2. pack modules
 */

const fs = require('fs')
const path = require('path')
const detective = require('detective')
const resolve = require('resolve')

let ID = 0

/**
 * Get a object which includes the id, file path, source code, dependencies of a module
 * @param {string} filePath
 */
function getModuleObject(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8')
  const dependencies = detective(source)
  const id = ID++

  return {id, filePath, source, dependencies}
}

/**
 * Get all modules in the dependencies graph from a entry point
 * @param {string} entryPath
 */
function getModules(entryPath) {
  const rootModuleObj = getModuleObject(entryPath)
  const modules = [rootModuleObj]

  for (const module of modules) {
    module.map = {}
    module.dependencies.forEach(dependency => {
      const basedir = path.dirname(module.filePath)
      const dependencyPath = resolve.sync(dependency, { basedir })
      const insideModuleObj = getModuleObject(dependencyPath)
      module.map[dependency] = insideModuleObj.id

      modules.push(insideModuleObj)
    })
  }

  return modules
}

/**
 * Pack all modules
 * @param {array} modules
 */
function pack(modules) {
  const modulesSource = modules.map(moduleObj => `
    ${moduleObj.id}: {
      factory: (module, require) => {
        ${moduleObj.source}
      },
      map: ${JSON.stringify(moduleObj.map)}
    }
  `).join(',')

  return `(modules => {
    const require = id => {
      const { factory, map } = modules[id]
      const module = { exports: {} }
      const localRequire = modulePath => require(map[modulePath])

      factory(module, localRequire)

      return module.exports
    }
    
    require(0)
  })({ ${modulesSource} })`
}

module.exports = entry => pack(getModules(entry))