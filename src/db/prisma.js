// src/db/prisma.js
'use strict';

const { PrismaClient } = require('@prisma/client');

let prisma;

/**
 * Prisma client singleton.
 * - In dev with nodemon, this prevents creating multiple clients on reload.
 */
function getPrisma() {
  if (prisma) return prisma;

  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error']
  });

  return prisma;
}

module.exports = {
  prisma: getPrisma()
};
