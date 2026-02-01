'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const router = express.Router();

const WIKI_DIR = path.join(__dirname, '../../wiki');

function getPage(slug) {
  const file = slug === 'index'
    ? 'index.md'
    : `${slug}.md`;

  const fullPath = path.join(WIKI_DIR, file);
  if (!fs.existsSync(fullPath)) return null;

  return fs.readFileSync(fullPath, 'utf8');
}

router.get('/wiki', (req, res) => {
  const md = getPage('index');
  const html = marked.parse(md || '# Wiki Coming Soon');

  res.render('wiki', {
    title: 'Wiki',
    content: html,
    slug: 'index'
  });
});

router.get('/wiki/:slug', (req, res) => {
  const { slug } = req.params;
  const md = getPage(slug);

  if (!md) {
    return res.status(404).render('wiki', {
      title: 'Not Found',
      content: '<h2>Page not found</h2>',
      slug
    });
  }

  res.render('wiki', {
    title: slug.replace(/-/g, ' '),
    content: marked.parse(md),
    slug
  });
});

module.exports = router;
