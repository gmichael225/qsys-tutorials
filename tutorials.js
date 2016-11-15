angular.module('qsys-scripting-tutorials', ['ui.ace', 'uuid'])

  .service('Moonshine', function($rootScope, $window) {

    return {

      init: function(conf) {
        if(!conf) { conf = {}; }
        if(conf.stdout) {
          $window.shine.stdout.write = function(msg) {
            conf.stdout(msg);
          }
        }
        $rootScope.moonshine = new $window.shine.VM(conf.api);
        $window.shine.luac.init($rootScope.moonshine, 'moonshine/yueliang.lua.json');
      },

      compile: function(code) {
        return {
          then: function(callback) {
            $window.shine.luac.compile(code, callback);
          }
        }
      },

      run: function(bytecode) {
        $rootScope.moonshine._resetGlobals();
        $rootScope.moonshine.load(bytecode);
      }

    };

  })

  .service('QSysAPI', function(uuid4, $http) {

    return function(config) {

      function err(msg) {
        config.stderr(msg);
      }

      var timers = [];

      var QSysEOLConstants = {
        Any: 'ANY',
        CrLf: 'CRLF',
        CrLfStrict: 'CRLF_STRICT',
        Lf: 'LF',
        Null: 'NULL',
        Custom: 'CUSTOM'
      };

      var QSysEventConstants = {
        Connected: 'CONNECTED',
        Reconnect: 'RECONNECT',
        Data: 'DATA',
        Closed: 'CLOSED',
        Error: 'ERROR',
        Timeout: 'TIMEOUT'
      };

      return {

        reset: function() {
          for(var i in timers) {
            clearInterval(timers[i]);
          } timers = [];
        },

        api: {

          // Controls
          Controls: {},

          // Timers
          Timer: {
            New: function() {
              var timerID = uuid4.generate();
              return {
                Start: function(self, interval) {
                  timers[timerID] = setInterval(function() {
                    self.EventHandler.call();
                  }, interval*1000);
                },
                Stop: function(self) {
                  clearInterval(timers[timerID]);
                  delete timers[timerID];
                }
              }
            }
          },

          // Logging
          // TODO: Where should this go?
          Log: {
            Message: function(msg) { },
            Error: function(msg) { }
          },

          // TCP Sockets
          TcpSocket: {
            Events: QSysEventConstants,
            EOL: QSysEOLConstants,
            New: function() {
              return {
                Connect: function() {},
                Disconnect: function() {},
                Write: function() {},
                Read: function() {},
                ReadLine: function() {},
                Search: function() {},
                ReadTimeout: 0,
                WriteTimeout: 0,
                ReconnectTimeout: 5,
                IsConnected: false,
                BufferLength: 0
              }
            }
          },

          UdpSocket: {
            New: function() {
              return {
                Open: function () {},
                Close: function () {},
                Send: function() {},
                JoinMulticast: function() {}
              }
            }
          },

          TcpSocketServer: {
            New: function() {
              return {
                Listen: function() {},
                Close: function() {}
              }
            }
          },

          // Serial Ports
          SerialPorts: [{
            Open: function() {},
            Close: function() {},
            Write: function() {},
            Read: function() {},
            ReadLine: function() {},
            Search: function() {}
          }],

          // HTTP Client
          HttpClient: {
            Download: function(tbl) {

              var orig_tbl = angular.copy(tbl);

              // simulate q-sys error messages
              if(!tbl) { err('table expected'); return; }
              //if(tbl.Url === '') { return; } // fail silently
              if(tbl.Url == undefined) { err('Url required'); return; }
              if(!tbl.EventHandler || !tbl.EventHandler.call) { err('EventHandler function required'); return; }
              if(tbl.Url == '') { tbl.EventHandler.call(null, tbl, 0, null, '<url> malformed'); return; }
              if(tbl.Url.substr(0,4).toLowerCase() != 'http') {
                tbl.EventHandler.call(null, tbl, 0, null, 'Could not resolve host: '+tbl.Url); return;
              }

              tbl.EventHandler.retain();

              $http({
                method: 'GET',
                url: 'https://crossorigin.me/'+tbl.Url,
                headers: tbl.Headers
              }).then(function success(response) {
                tbl.EventHandler.call(null, orig_tbl, response.status, response.data);
              }, function error(response) {
                tbl.EventHandler.call(null, orig_tbl, response.status, response.data);
              })
            },
            Upload: function() {
              err('HTTP Uploads are not permitted in tutorials.');
            }
          },

          // Mixer API
          Mixer: {
            New: function(name) {
              err('No mixer named \''+name+'\'');
            }
          },

          // Constants
          ChannelGroup: { Index: 0 },
          System: { IsEmulating: false }

        }

      };

    };
  })

  .controller('ScriptingController', function($scope, $timeout, Moonshine, QSysAPI) {

    // Set up API
    var api = QSysAPI({
      stderr: function(err) {
        $timeout(function() {
          $scope.$apply(function() {
            $scope.lines.push({msg: err, err: true});
          });
        });
      }
    })

    // Set up stdout
    $scope.lines = [];
    Moonshine.init({
      stdout: function(msg) {
        $timeout(function() {
          $scope.$apply(function() {
            $scope.lines.push({msg: msg});
          });
        });
      },
      api: api.api
    });

    // Compiler
    $scope.compile = function(src) {
      $scope.sync = true;
      api.reset();
      Moonshine.compile(src)
        .then(function(err, bytecode) {
          if(bytecode) {
            $scope.lines = [];
            Moonshine.run(bytecode);
          }
        });
    };

    // Sample script
    $scope.script = `print('hello world!');`

    // Script dirty watch
    $scope.sync = true;
    $scope.$watch('script', function(newValue, oldValue) {
      if(newValue != oldValue) {
        $scope.sync = false;
      }
    });

  })