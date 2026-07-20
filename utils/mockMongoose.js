const EventEmitter = require('events');

// In-memory collections store
const collections = {
  skills: [],
  skillregistries: [],
  roadmaps: []
};

// Seed initial skill registries if empty to make the app functional on startup
const initialRegistries = [
  { skillId: 'react', name: 'React', category: 'Frontend', level: 1 },
  { skillId: 'nodejs', name: 'Node.js', category: 'Backend', level: 1 },
  { skillId: 'typescript', name: 'TypeScript', category: 'Languages', level: 1 },
  { skillId: 'mongodb', name: 'MongoDB', category: 'Databases', level: 1 },
  { skillId: 'docker', name: 'Docker', category: 'DevOps', level: 1 }
];

class QueryChain {
  constructor(data) {
    this.data = data || [];
  }

  sort(sortOptions) {
    // Basic sort implementation
    if (sortOptions && typeof sortOptions === 'object') {
      const field = Object.keys(sortOptions)[0];
      const order = sortOptions[field];
      this.data.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (order === -1) {
          return valA > valB ? -1 : 1;
        }
        return valA > valB ? 1 : -1;
      });
    } else if (typeof sortOptions === 'string') {
      const isDesc = sortOptions.startsWith('-');
      const field = isDesc ? sortOptions.substring(1) : sortOptions;
      this.data.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        if (isDesc) {
          return valA > valB ? -1 : 1;
        }
        return valA > valB ? 1 : -1;
      });
    }
    return this;
  }

  limit(n) {
    this.data = this.data.slice(0, n);
    return this;
  }

  select() {
    return this;
  }

  then(onResolve) {
    return Promise.resolve(this.data).then(onResolve);
  }

  catch(onReject) {
    return Promise.resolve(this.data).catch(onReject);
  }
}

// Map model names to collection keys
const getCollectionKey = (modelName) => {
  const lower = modelName.toLowerCase();
  if (lower.includes('registry')) return 'skillregistries';
  if (lower.includes('roadmap')) return 'roadmaps';
  return 'skills';
};

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const createModelClass = (modelName, schema) => {
  const collectionKey = getCollectionKey(modelName);

  // Initialize collection
  if (!collections[collectionKey]) {
    collections[collectionKey] = [];
  }

  // Pre-seed registries if we are initializing the skillregistry collection
  if (collectionKey === 'skillregistries' && collections[collectionKey].length === 0) {
    initialRegistries.forEach(item => {
      collections[collectionKey].push({
        _id: generateId(),
        ...item,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  }

  class Model {
    constructor(data = {}) {
      Object.assign(this, data);

      // Bind schema methods to this instance
      if (schema && schema.methods) {
        Object.keys(schema.methods).forEach(key => {
          if (typeof schema.methods[key] === 'function') {
            this[key] = schema.methods[key].bind(this);
          }
        });
      }

      if (!this._id) {
        this._id = generateId();
      }
      this.createdAt = this.createdAt || new Date();
      this.updatedAt = this.updatedAt || new Date();
    }

    async save() {
      const col = collections[collectionKey];
      const index = col.findIndex(item => item._id === this._id);
      
      // Convert instance to plain object, preserving getters/methods
      const plainObj = {};
      Object.keys(this).forEach(k => {
        plainObj[k] = this[k];
      });

      if (index >= 0) {
        col[index] = { ...col[index], ...plainObj, updatedAt: new Date() };
        Object.assign(this, col[index]);
      } else {
        plainObj.createdAt = plainObj.createdAt || new Date();
        plainObj.updatedAt = plainObj.updatedAt || new Date();
        col.push(plainObj);
        Object.assign(this, plainObj);
      }
      return this;
    }

    // Instance method specifically for Roadmap
    calculateProgress() {
      if (this.levels) {
        let total = 0;
        let completed = 0;
        this.levels.forEach(lvl => {
          if (lvl.tasks) {
            lvl.tasks.forEach(t => {
              total++;
              if (t.completed) completed++;
            });
          }
        });
        this.totalTasks = total;
        this.completedTasks = completed;
        this.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      }
    }

    static async create(data) {
      const instance = new Model(data);
      return await instance.save();
    }

    static find(filter = {}) {
      console.log(`📡 [MOCK MONGOOSE] Find on ${modelName} with filter:`, JSON.stringify(filter));
      const col = collections[collectionKey];
      
      // Match simple filter properties
      const results = col.filter(item => {
        for (const key of Object.keys(filter)) {
          if (filter[key] && typeof filter[key] === 'object' && filter[key].$regex) {
            // Regex query helper
            const regex = filter[key].$regex;
            const value = item[key];
            if (typeof value === 'string' && regex.test(value)) {
              continue;
            }
            return false;
          }
          if (item[key] !== filter[key]) return false;
        }
        return true;
      });

      // Wrap in class instances
      const instances = results.map(r => new Model(r));
      return new QueryChain(instances);
    }

    static findOne(filter = {}) {
      console.log(`📡 [MOCK MONGOOSE] FindOne on ${modelName} with filter:`, JSON.stringify(filter));
      const col = collections[collectionKey];
      const matched = col.find(item => {
        for (const key of Object.keys(filter)) {
          if (filter[key] && typeof filter[key] === 'object' && filter[key].$regex) {
            const regex = filter[key].$regex;
            const value = item[key];
            if (typeof value === 'string' && regex.test(value)) {
              continue;
            }
            return false;
          }
          if (item[key] !== filter[key]) return false;
        }
        return true;
      });

      const res = matched ? new Model(matched) : null;
      // Return a chainable object that also functions as a promise
      return {
        sort: function(sortOpts) {
          return this;
        },
        then: function(onResolve) {
          return Promise.resolve(res).then(onResolve);
        },
        catch: function(onReject) {
          return Promise.resolve(res).catch(onReject);
        }
      };
    }

    static findById(id) {
      console.log(`📡 [MOCK MONGOOSE] FindById on ${modelName} with ID:`, id);
      const col = collections[collectionKey];
      const matched = col.find(item => item._id === id);
      const res = matched ? new Model(matched) : null;
      return Promise.resolve(res);
    }

    static findByIdAndDelete(id) {
      console.log(`📡 [MOCK MONGOOSE] FindByIdAndDelete on ${modelName} with ID:`, id);
      const col = collections[collectionKey];
      const index = col.findIndex(item => item._id === id);
      let deleted = null;
      if (index >= 0) {
        deleted = new Model(col[index]);
        col.splice(index, 1);
      }
      return Promise.resolve(deleted);
    }

    static async updateMany(filter = {}, update = {}) {
      console.log(`📡 [MOCK MONGOOSE] UpdateMany on ${modelName} with filter:`, filter, 'update:', update);
      const col = collections[collectionKey];
      let count = 0;
      col.forEach((item, index) => {
        let matches = true;
        for (const key of Object.keys(filter)) {
          if (item[key] !== filter[key]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          // If update contains $set, use it, otherwise merge directly
          const updateData = update.$set || update;
          col[index] = { ...item, ...updateData, updatedAt: new Date() };
          count++;
        }
      });
      return { matchedCount: count, modifiedCount: count };
    }

    static async deleteMany(filter = {}) {
      console.log(`📡 [MOCK MONGOOSE] DeleteMany on ${modelName} with filter:`, filter);
      const col = collections[collectionKey];
      const initialLength = col.length;
      collections[collectionKey] = col.filter(item => {
        for (const key of Object.keys(filter)) {
          if (item[key] !== filter[key]) return true;
        }
        return false;
      });
      return { deletedCount: initialLength - collections[collectionKey].length };
    }
  }

  // Bind static methods if present in schema.statics
  if (schema && schema.statics) {
    Object.keys(schema.statics).forEach(key => {
      Model[key] = schema.statics[key];
    });
  }

  return Model;
};

// Schema class placeholder
class Schema {
  constructor(definition, options) {
    this.definition = definition;
    this.options = options;
    this.methods = {};
    this.statics = {};
  }

  method(name, fn) {
    this.methods[name] = fn;
    return this;
  }

  index(fields, options) {
    return this;
  }

  plugin(fn, options) {
    return this;
  }

  pre(hook, fn) {
    return this;
  }

  post(hook, fn) {
    return this;
  }

  virtual(name) {
    return {
      get: function() { return this; },
      set: function() { return this; }
    };
  }
}

// Mock Mongoose export
const mockMongoose = {
  Schema: Schema,
  model: (name, schema) => {
    return createModelClass(name, schema);
  },
  connect: async (uri, options) => {
    console.log('📡 [MOCK MONGOOSE] Connected to simulated in-memory database successfully.');
    return Promise.resolve(true);
  },
  connection: new EventEmitter()
};

module.exports = mockMongoose;
