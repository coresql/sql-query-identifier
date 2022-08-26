import { parse } from '../../src/parser';
import { expect } from 'chai';

describe('Parser for bigquery', () => {
  // all testcases are taken straight from bigquery docs on procedural language
  // see https://cloud.google.com/bigquery/docs/reference/standard-sql/procedural-language
  describe('control structures', () => {
    [
      `CASE
        WHEN
          EXISTS(SELECT 1 FROM schema.products_a WHERE product_id = target_product_id)
          THEN SELECT 'found product in products_a table';
        WHEN
          EXISTS(SELECT 1 FROM schema.products_b WHERE product_id = target_product_id)
          THEN SELECT 'found product in products_b table';
        ELSE
          SELECT 'did not find product';
      END CASE;`,
      `IF EXISTS(SELECT 1 FROM schema.products
        WHERE product_id = target_product_id) THEN
        SELECT CONCAT('found product ', CAST(target_product_id AS STRING));
        ELSEIF EXISTS(SELECT 1 FROM schema.more_products
                WHERE product_id = target_product_id) THEN
        SELECT CONCAT('found product from more_products table',
        CAST(target_product_id AS STRING));
        ELSE
        SELECT CONCAT('did not find product ', CAST(target_product_id AS STRING));
      END IF;`,
      `LOOP
        SET x = x + 1;
        IF x >= 10 THEN
          LEAVE;
        END IF;
      END LOOP;`,
      `REPEAT
        SET x = x + 1;
        SELECT x;
        UNTIL x >= 3
      END REPEAT;`,
      `WHILE x < 0 DO
          SET x = x + 1;
          SELECT x;
      END WHILE;`,
      `FOR record IN
        (SELECT word, word_count
        FROM bigquery-public-data.samples.shakespeare
        LIMIT 5)
      DO
        SELECT record.word, record.word_count;
      END FOR;`,
    ].forEach((sql) => {
      it(`parses ${sql.substring(
        0,
        Math.min(sql.indexOf(' '), sql.indexOf('\n')),
      )} structure`, () => {
        const result = parse(`${sql}\nSELECT 1;`, false, 'bigquery');
        expect(result.body.length).to.eql(2);
        expect(sql.substring(result.body[0].start, result.body[0].end + 1)).to.eql(sql);
        expect(result.body[0].type).to.eql('UNKNOWN');
        expect(result.body[1].type).to.eql('SELECT');
      });
    });
  });
});
