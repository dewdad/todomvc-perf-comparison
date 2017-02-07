/*global Vue, todoStorage */

(function (exports) {

  'use strict';

  var filters = {
    all: function (todo) {
      return true;
    },
    active: function (todo) {
      return !todo.completed;
    },
    completed: function (todo) {
      return todo.completed;
    }
  };

  link.filter('pluralize', function (n) {
    return n <= 1 ? 'item' : 'items'
  });

  var linker = linker = link({

    // the root element that will be compiled
    el: document.querySelector('#todoapp'),

    model: {
      todos: [],
      newTodo: '',
      editedTodo: null,
      filterTodos: [],
      allDone: false,
      remaining: 0,
      filter: 'all'
    },

    methods: {
      addTodo: function (ev) {
        if (ev.keyCode !== 13) return;
        var value = this.newTodo && this.newTodo.trim()
        if (!value) {
          return
        }
        this.todos.push({ title: value, completed: false });
        this.newTodo = '';
      },

      removeTodo: function (todo) {
        this.todos.splice(this.todos.indexOf(todo), 1);
      },

      editTodo: function (todo) {
        this.beforeEditCache = todo.title
        this.editedTodo = todo
      },

      doneEdit: function (todo, ev) {
        if (ev.keyCode === 13) {
          if (!this.editedTodo) {
            return
          }
          this.editedTodo = null
          todo.title = todo.title.trim()
          if (!todo.title) {
            this.removeTodo(todo)
          }
        }
        else if (ev.keyCode === 27) {
          //esc
          this.cancelEdit(todo);
        }

      },

      cancelEdit: function (todo) {
        this.editedTodo = null
        todo.title = this.beforeEditCache
      },

      removeCompleted: function () {
        this.todos = this.todos.filter(filters.active)
      }
    }
  });

  linker.watch('todos', function () {
    var vm = linker.model;
    vm.filterTodos = vm.todos.filter(filters[vm.filter])
  });

  var timer = 0;

  linker.watch('filterTodos', function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      var vm = linker.model;
      todoStorage.save(vm.todos);
      vm.remaining = vm.todos.filter(filters.active).length;
    }, 0);
  });

  linker.watch('allDone', function () {
    var vm = linker.model;
    vm.todos.forEach(function (item) {
      item.completed = vm.allDone;
    });
  });

  linker.watch('filter', function () {
    var vm = linker.model;
    vm.filterTodos = vm.todos.filter(filters[vm.filter])
  });
  linker.model.todos = todoStorage.fetch();

  var app = linker.model;
  app.filters = filters;

  exports.app = app;

})(window);