 <?php
      header('Access-Control-Allow-Origin: *');
      header('Content-type: application/json');
       $names = array();
       $scores = array();
       $name = $_POST['name'];
       if ($name == null) {
         $name = 'guest';
       }
      $score = $_POST['score'];
      $i = 0;
      if (true) {
       // if ($_POST["name"] || $_POST["score"]) {
        array_push($names, $name);
        array_push($scores, $score);
        $response = array();
        $response['names']  = $names;
        $response['scores'] = $scores;
        echo(json_encode($response));
     }
  ?>
