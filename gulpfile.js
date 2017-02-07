'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();

gulp.task('default', function () {
  $.connect.server({
    root: './todomvc-benchmark/',
    livereload: true,
    port: 9008
  });
});