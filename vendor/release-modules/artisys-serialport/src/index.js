'use strict';
const {SerialError,normalizeSerialError}=require('./errors');
const {normalizeDeviceProfile}=require('./device-profile');
const {createSerialTransport}=require('./serial-transport');
const {createSerialPortManager}=require('./serial-port-manager');
const {createRequestResponseSession}=require('./request-response-session');
const {parseNumericWeight}=require('./parsers/numeric-weight');
const {createScaleAdapter}=require('./adapters/scale');
module.exports={SerialError,normalizeSerialError,normalizeDeviceProfile,createSerialTransport,createSerialPortManager,createRequestResponseSession,parseNumericWeight,createScaleAdapter};
