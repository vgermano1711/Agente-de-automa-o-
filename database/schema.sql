-- =============================================================================
-- Braseiro Pizzaria — modelo de banco de dados (MySQL 8+)
-- =============================================================================
-- Como usar:
--   1. Abra o MySQL Workbench (ou phpMyAdmin, ou `mysql -u root -p`).
--   2. Rode este arquivo inteiro (File > Run SQL Script no Workbench, ou
--      `mysql -u root -p < schema.sql` no terminal).
--   3. Depois rode o seed.sql pra ter dados de exemplo pra praticar consultas.
--
-- Ordem das tabelas: pessoa -> endereco -> produto -> pedido -> item_pedido.
-- Essa ordem importa porque cada tabela só pode referenciar (FOREIGN KEY)
-- uma tabela que já existe.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS braseiro_pizzaria
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE braseiro_pizzaria;

-- -----------------------------------------------------------------------------
-- PESSOA
-- Cada linha é um cliente. CPF é único (ninguém pode se cadastrar duas vezes
-- com o mesmo CPF) — por isso o UNIQUE. Guardamos só os 11 dígitos, sem ponto
-- ou traço; formatação é problema da tela, não do banco.
-- -----------------------------------------------------------------------------
CREATE TABLE pessoa (
  id_pessoa       INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(120)  NOT NULL,
  cpf             CHAR(11)      NOT NULL UNIQUE,
  telefone        VARCHAR(20)   NOT NULL,
  email           VARCHAR(120)  UNIQUE,
  data_nascimento DATE,
  criado_em       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- ENDERECO
-- Uma pessoa pode ter mais de um endereço (casa, trabalho...), por isso é
-- uma tabela separada com FK pra pessoa, em vez de colunas soltas dentro de
-- "pessoa". Isso é uma relação 1:N (um pessoa -> vários enderecos).
-- ON DELETE CASCADE: se a pessoa for apagada, os endereços dela somem junto
-- (não faz sentido um endereço "órfão" sem dono).
-- -----------------------------------------------------------------------------
CREATE TABLE endereco (
  id_endereco   INT AUTO_INCREMENT PRIMARY KEY,
  id_pessoa     INT NOT NULL,
  cep           CHAR(8)      NOT NULL,
  logradouro    VARCHAR(150) NOT NULL,
  numero        VARCHAR(10)  NOT NULL,
  complemento   VARCHAR(60),
  bairro        VARCHAR(80)  NOT NULL,
  cidade        VARCHAR(80)  NOT NULL,
  estado        CHAR(2)      NOT NULL,
  apelido       VARCHAR(40)  DEFAULT 'Principal', -- ex: "Casa", "Trabalho"

  CONSTRAINT fk_endereco_pessoa
    FOREIGN KEY (id_pessoa) REFERENCES pessoa(id_pessoa)
    ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- PRODUTO
-- O cardápio. "tamanho" só faz sentido pra pizza (pequena/media/grande);
-- pra bebida/sobremesa fica NULL — por isso a coluna aceita NULL em vez de
-- criar uma tabela separada só pra isso (não vale a pena aqui).
-- -----------------------------------------------------------------------------
CREATE TABLE produto (
  id_produto    INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(80)  NOT NULL,
  categoria     ENUM('pizza_tradicional', 'pizza_especial', 'pizza_doce', 'bebida') NOT NULL,
  tamanho       ENUM('pequena', 'media', 'grande'),
  preco         DECIMAL(6,2) NOT NULL,
  disponivel    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- -----------------------------------------------------------------------------
-- PEDIDO
-- Cada pedido pertence a UMA pessoa e é entregue em UM endereço (que também
-- é da mesma pessoa). "status" evolui com o tempo — é assim que se acompanha
-- o pedido sem precisar de outra tabela.
-- -----------------------------------------------------------------------------
CREATE TABLE pedido (
  id_pedido       INT AUTO_INCREMENT PRIMARY KEY,
  id_pessoa       INT NOT NULL,
  id_endereco     INT NOT NULL,
  data_pedido     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('recebido', 'em_preparo', 'saiu_para_entrega', 'entregue', 'cancelado')
                    NOT NULL DEFAULT 'recebido',
  forma_pagamento ENUM('dinheiro', 'cartao_credito', 'cartao_debito', 'pix') NOT NULL,
  observacoes     VARCHAR(255),

  CONSTRAINT fk_pedido_pessoa
    FOREIGN KEY (id_pessoa) REFERENCES pessoa(id_pessoa),

  CONSTRAINT fk_pedido_endereco
    FOREIGN KEY (id_endereco) REFERENCES endereco(id_endereco)
);

-- -----------------------------------------------------------------------------
-- ITEM_PEDIDO
-- Tabela de junção entre pedido e produto: um pedido tem vários produtos, e
-- um produto aparece em vários pedidos — é uma relação N:N, resolvida com
-- essa tabela no meio.
-- "preco_unitario" guarda o preço NO MOMENTO do pedido (uma cópia do preço
-- do produto). Isso é de propósito: se você mudar o preço da pizza amanhã,
-- os pedidos antigos não podem mudar de valor retroativamente.
-- -----------------------------------------------------------------------------
CREATE TABLE item_pedido (
  id_item         INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido       INT NOT NULL,
  id_produto      INT NOT NULL,
  quantidade      INT NOT NULL DEFAULT 1,
  preco_unitario  DECIMAL(6,2) NOT NULL,

  CONSTRAINT fk_item_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
    ON DELETE CASCADE,

  CONSTRAINT fk_item_produto
    FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);
