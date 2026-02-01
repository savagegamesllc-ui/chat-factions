'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const router = express.Router();

const WIKI_ROOT = path.join(__dirname, '../../wiki');

/**
 * Resolve a wiki request path to a markdown file.
 * Priority:
 *  1) <path>.md
 *  2) <path>/index.md
 */
function resolveWikiFile(requestPath) {
  const clean = requestPath.replace(/^\/+|\/+$/g, '');

  const directFile = path.join(WIKI_ROOT, `${clean}.md`);
  if (fs.existsSync(directFile)) return directFile;

  const indexFile = path.join(WIKI_ROOT, clean, 'index.md');
  if (fs.existsSync(indexFile)) return indexFile;

  return null;
}

/**
 * /wiki
 */
router.get('/wiki', (req, res) => {
  const file = resolveWikiFile('index');

  if (!file) {
    return res.status(404).send('Wiki index not found');
  }

  const md = fs.readFileSync(file, 'utf8');

  res.render('wiki', {
    title: 'Wiki',
    content: marked.parse(md),
    path: '/'
  });
});

/**
 * /wiki/*
 */
router.get('/wiki/*', (req, res) => {
  const wikiPath = req.params[0]; // everything after /wiki/
  const file = resolveWikiFile(wikiPath);

  if (!file) {
    return res.status(404).render('wiki', {
      title: 'Not Found',
      content: `<h2>Page not found</h2><p>No wiki page for <code>${wikiPath}</code></p>`,
      path: wikiPath
    });
  }

  const md = fs.readFileSync(file, 'utf8');

  res.render('wiki', {
    title: wikiPath.split('/').pop(),
    content: marked.parse(md),
    path: wikiPath
  });
});

module.exports = router;
