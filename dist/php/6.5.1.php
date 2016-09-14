<?php
/*
 * Copyright 2007-2016 Abstrium <contact (at) pydio.com>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <https://pydio.com/>.
 */

function updateSharePhpContent($installPath, $publicFolder){

    $sharePhpPath = $installPath."/".trim($publicFolder, "/")."/"."share.php";
    if(!is_file($sharePhpPath)){
        echo "No share.php file was found in public folder. If it does exist, you may have to manually upgrade its content.";
    }
    $folders = array_map(function($value){
        return "..";
    }, explode("/", trim($publicFolder, "/")));
    $baseConfPath = implode("/", $folders);

    $content = '
    <?php
        include_once("'.$baseConfPath.'/base.conf.php");
        define(\'AJXP_EXEC\', true);
        require_once AJXP_INSTALL_PATH."/".AJXP_PLUGINS_FOLDER."/action.share/vendor/autoload.php";
        $base = rtrim(dirname($_SERVER["SCRIPT_NAME"]), "/");
        \Pydio\Share\ShareCenter::publicRoute($base, "/proxy", ["hash" => $_GET["hash"]]);    
    ';
    file_put_contents($sharePhpPath, $content);

}

function updateHtAccessContent($htAccessPath){

    if(!is_file($htAccessPath)){
        echo "No htaccess file found. Skipping Htaccess update.";
    }
    $lines = file($htAccessPath);
    $startRemoving = false;
    // Remove unnecessary lines
    foreach($lines as $index => $line){
        if(!$startRemoving && strpos($line, "RewriteRule ") !== 0){
            continue;
        }
        if(trim($line) === 'RewriteRule (.*) index.php [L]'){
            break;
        }else{
            unset($lines[$index]);
        }
    }
    $contents = implode("\n", $lines);
    if(is_writable($htAccessPath)){
        file_put_contents($htAccessPath, $contents);
    }else{
        echo "ERROR: Htaccess file could not be written. Update it manually to the following content: <pre>$contents</pre>";
    }

}

function awsSdkVersion(){

    $s3Options = \Pydio\Core\Services\ConfService::getConfStorageImpl()->loadPluginConfig("access", "s3");
    if($s3Options["SDK_VERSION"] === "v2"){
        $s3Options["SDK_VERSION"] = "v3";
        \Pydio\Core\Services\ConfService::getConfStorageImpl()->savePluginConfig("access.s3", $s3Options);
    }

}