-- =============================================================================
-- Braseiro Pizzaria — dados de exemplo pra praticar
-- Rode depois do schema.sql. Os CPFs aqui são inventados, só pra preencher
-- a coluna — não use CPF de gente de verdade nem os seus próprios dados
-- reais num banco de estudo.
-- =============================================================================

USE braseiro_pizzaria;

-- ---------------------------------------------------------------------------
-- PESSOA
-- ---------------------------------------------------------------------------
INSERT INTO pessoa (nome, cpf, telefone, email, data_nascimento) VALUES
  ('Ana Carolina Souza',   '11122233344', '11987654321', 'ana.souza@email.com',    '1994-03-12'),
  ('Bruno Ferreira Lima',  '22233344455', '11976543210', 'bruno.lima@email.com',   '1988-07-25'),
  ('Carla Mendes Ribeiro', '33344455566', '11965432109', 'carla.ribeiro@email.com','1999-11-02'),
  ('Diego Alves Cardoso',  '44455566677', '11954321098', 'diego.cardoso@email.com','1991-05-19');

-- ---------------------------------------------------------------------------
-- ENDERECO (repare que a Ana tem dois endereços — casa e trabalho)
-- ---------------------------------------------------------------------------
INSERT INTO endereco (id_pessoa, cep, logradouro, numero, complemento, bairro, cidade, estado, apelido) VALUES
  (1, '01310100', 'Avenida Paulista',        1500, 'Apto 92',  'Bela Vista',   'São Paulo', 'SP', 'Casa'),
  (1, '04538133', 'Avenida Brigadeiro',      500,  '10º andar','Itaim Bibi',   'São Paulo', 'SP', 'Trabalho'),
  (2, '05407002', 'Rua Cardeal Arcoverde',   80,   NULL,       'Pinheiros',    'São Paulo', 'SP', 'Casa'),
  (3, '02011000', 'Rua Voluntários da Pátria', 320, 'Casa 2',  'Santana',      'São Paulo', 'SP', 'Casa'),
  (4, '03310000', 'Rua Coronel Oscar Porto', 210,  NULL,       'Vila Mariana', 'São Paulo', 'SP', 'Casa');

-- ---------------------------------------------------------------------------
-- PRODUTO (cardápio da Braseiro)
-- ---------------------------------------------------------------------------
INSERT INTO produto (nome, categoria, tamanho, preco, disponivel) VALUES
  ('Marguerita',       'pizza_tradicional', 'grande', 52.90, TRUE),
  ('Calabresa',        'pizza_tradicional', 'grande', 49.90, TRUE),
  ('Mussarela',        'pizza_tradicional', 'grande', 45.90, TRUE),
  ('Portuguesa',       'pizza_tradicional', 'grande', 54.90, TRUE),
  ('Quatro Queijos',   'pizza_especial',    'grande', 62.90, TRUE),
  ('Bacon com Cheddar','pizza_especial',    'grande', 64.90, TRUE),
  ('Chocolate',        'pizza_doce',        'media',  39.90, TRUE),
  ('Banana com Canela','pizza_doce',        'media',  36.90, TRUE),
  ('Refrigerante 2L',  'bebida',            NULL,     12.00, TRUE),
  ('Suco Natural 500ml','bebida',           NULL,     9.00,  TRUE);

-- ---------------------------------------------------------------------------
-- PEDIDO + ITEM_PEDIDO
-- Pedido 1: Ana pediu duas pizzas e um refrigerante, entregue no endereço de casa dela.
-- ---------------------------------------------------------------------------
INSERT INTO pedido (id_pessoa, id_endereco, status, forma_pagamento, observacoes) VALUES
  (1, 1, 'entregue',          'pix',            'Tocar a campainha do apto'),
  (2, 3, 'saiu_para_entrega', 'cartao_credito', NULL),
  (3, 4, 'em_preparo',        'dinheiro',       'Troco pra 100'),
  (1, 2, 'recebido',          'cartao_debito',  'Entregar na portaria da empresa');

-- Pedido 1 (Ana, id_pedido = 1): Marguerita + Calabresa + Refrigerante
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES
  (1, 1, 1, 52.90),
  (1, 2, 1, 49.90),
  (1, 9, 1, 12.00);

-- Pedido 2 (Bruno, id_pedido = 2): Quatro Queijos + Suco
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES
  (2, 5, 1, 62.90),
  (2, 10, 2, 9.00);

-- Pedido 3 (Carla, id_pedido = 3): Portuguesa + Pizza de Chocolate
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES
  (3, 4, 1, 54.90),
  (3, 7, 1, 39.90);

-- Pedido 4 (Ana de novo, agora entregando no trabalho, id_pedido = 4): Mussarela
INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario) VALUES
  (4, 3, 2, 45.90);
