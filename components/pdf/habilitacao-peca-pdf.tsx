/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: '30mm 25mm',
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.6,
    textAlign: 'justify',
    color: '#000000'
  },
  header: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 40,
  },
  processInfo: {
    textAlign: 'right',
    fontWeight: 'bold',
    marginBottom: 40,
  },
  paragraph: {
    marginBottom: 20,
    textIndent: 50,
  },
  bold: {
    fontWeight: 'bold'
  },
  center: {
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  signatureArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 60,
  },
  line: {
    width: '60%',
    borderTop: '1pt solid black',
    marginBottom: 5,
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 40,
    textTransform: 'uppercase',
  }
});

export function HabilitacaoPecaPDF({ data }: { data: any }) {
  const { 
    vara, comarca, numeroProcesso, cliente, advogado, 
    tipoAcao, reuNome, reuCnpj, cidadeEmissao, dataFormatada, selectedState, includeBankInfo, includeProcessNumber 
  } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>
          EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA {vara} DA COMARCA DE {comarca}.
        </Text>

        {includeProcessNumber && (
          <Text style={styles.processInfo}>Processo nº {numeroProcesso}</Text>
        )}

        <View style={styles.paragraph}>
          <Text>
            <Text style={styles.bold}>{cliente.nome.toUpperCase()}</Text>, brasileiro(a), {cliente.estadoCivil}, {cliente.profissao}, portador da cédula de identidade RG número {cliente.rg} e inscrito no CPF/MF sob o nº {cliente.cpf}, residente e domiciliado na {cliente.endereco}, vem, respeitosamente, à presença de Vossa Excelência, por seu procurador, ora constituído, apresentar seu pedido de habilitação e requerer a juntada do anexo instrumento particular de mandato.
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text>
            Inicialmente, requer-se que as intimações sejam feitas em nome do procurador <Text style={styles.bold}>Dr. {advogado.nome.toUpperCase()}</Text>, {advogado.nacionalidade}, {advogado.estadoCivil}, inscrito na <Text style={styles.bold}>OAB/{selectedState} {advogado.oab}</Text>, com escritório profissional na {advogado.endereco}, CEP {advogado.cep}, e-mail: {advogado.email}, requerendo que seja feita as respectivas anotações que se fizerem necessárias.
          </Text>
        </View>

        <View style={styles.center}>
          <Text>Nestes Termos,</Text>
          <Text>Pede Deferimento.</Text>
          <Text style={{ marginTop: 20 }}>{cidadeEmissao}, {dataFormatada}.</Text>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.line} />
          <Text style={styles.bold}>{advogado.nome.toUpperCase()}</Text>
          <Text style={styles.bold}>OAB/{selectedState} Nº {advogado.oab}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PROCURAÇÃO "AD JUDICIA"</Text>

        <View style={styles.paragraph}>
          <Text>
            <Text style={styles.bold}>{cliente.nome.toUpperCase()}</Text>, {cliente.nacionalidade || "brasileiro(a)"}, {cliente.estadoCivil}, {cliente.profissao}, portador do RG sob Nº {cliente.rg} e devidamente inscrito no CPF sob Nº {cliente.cpf}, residente e domiciliado à {cliente.endereco}, com endereço eletrônico: {cliente.email || 'Não informado'}, neste ato nomeia como seu procurador:
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text>
            <Text style={styles.bold}>{advogado.nome.toUpperCase()}</Text>, {advogado.nacionalidade}, {advogado.estadoCivil}, advogado, inscrito na OAB/{selectedState} sob o número {advogado.oab}, com endereço profissional na {advogado.endereco}, CEP {advogado.cep}, e endereço eletrônico: {advogado.email}.
          </Text>
        </View>

        <View style={styles.paragraph}>
          <Text>
            <Text style={styles.bold}>PODERES:</Text> Por este instrumento particular de mandato, o(a) outorgante retro referenciada nomeia e constitui seu bastante procurador o advogado também acima qualificado, a quem confere amplos poderes para o foro em geral, com a cláusula <Text style={styles.bold}>"AD JUDICIA"</Text>, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-lo nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhes, ainda, poderes especiais para desistir, transigir, firmar compromissos ou aquisições de acordos, receber e dar quitação, agindo em conjunto ou separadamente e independente da ordem de nomeação, podendo substabelecer esta em outrem, com ou sem reservas de iguais poderes, especialmente para, na defesa dos interesses do(a) outorgante, agir nos autos da <Text style={styles.bold}>{tipoAcao.toUpperCase()}</Text> {includeBankInfo ? `promovida contra o ${reuNome.toUpperCase()}, inscrito no CNPJ sob o nº ${reuCnpj || '---'}` : ""}{includeProcessNumber ? `, processo nº ${numeroProcesso}` : ""}.
          </Text>
        </View>

        <View style={styles.center}>
          <Text>{cidadeEmissao}, {dataFormatada}.</Text>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.line} />
          <Text style={styles.bold}>{cliente.nome.toUpperCase()}</Text>
        </View>
      </Page>
    </Document>
  );
}
